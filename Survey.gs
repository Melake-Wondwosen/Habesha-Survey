/**
 * Outlet Survey backend. Add this file to the SAME Apps Script project the
 * wheel app uses, then add ONE line at the top of your existing doPost:
 *
 *   function doPost(e) {
 *     var body = JSON.parse(e.postData.contents);
 *     var r = surveyRoute_(body); if (r) return surveyJson_(r);
 *     ... your existing wheel actions, untouched ...
 *   }
 *
 * The survey app uses its own action names, so the wheel app's `login` is not
 * affected.
 *
 * Users tab: needs `username` and `password` columns. Optional `id`, `name`,
 * `role` and `active`. Role is "admin", "manager" or blank (= BA). Put "no"
 * in active to block a user. The admin console fills these in for you.
 *
 * Run surveySetup once, then: Deploy > Manage deployments > Edit > New version.
 */

var SURVEY_SHEET = 'Surveys';
var USERS_SHEET = 'Users';
var PRESENCE_SHEET = 'Presence';
var TRACK_SHEET = 'Track';
var LOGINS_SHEET = 'Logins';
var FLAGS_SHEET = 'Flags';
var OUTLETS_SHEET = 'Outlets';
var NOTICES_SHEET = 'Notifications';
var SURVEY_BRANDS = ['Habesha', 'Harar', 'Dashen', 'Bedele', 'StGeorge', 'Meta', 'Other'];
var ROLES = ['ba', 'manager', 'admin'];
// A survey further than this from its outlet's coordinates raises an alert
var OUTLET_RANGE_M = 100;

var SURVEY_HEADERS = ['id', 'date', 'baId', 'baName', 'outletId', 'outletName', 'city']
  .concat(SURVEY_BRANDS.map(function (b) { return 'rank' + b; }))
  .concat(['otherBrandName'])
  .concat(SURVEY_BRANDS.map(function (b) { return 'crates' + b; }))
  .concat(['reason', 'reasonOther', 'lat', 'lng', 'accuracy', 'distanceM']);

var SHEET_HEADERS = {
  Surveys: SURVEY_HEADERS,
  Presence: ['baId', 'baName', 'lastSeen', 'state', 'activity', 'lat', 'lng', 'accuracy', 'locTime', 'device'],
  Track: ['date', 'baId', 'baName', 'lat', 'lng', 'accuracy', 'activity'],
  Logins: ['date', 'baId', 'baName', 'role', 'lat', 'lng', 'accuracy', 'device'],
  Flags: ['id', 'date', 'baId', 'baName', 'type', 'detail', 'status', 'resolvedBy', 'resolvedAt'],
  Outlets: ['key', 'outletId', 'outletName', 'status', 'requestedBy', 'requestedByName', 'lat', 'lng', 'createdAt', 'updatedAt'],
  Notifications: ['id', 'date', 'fromId', 'fromName', 'target', 'kind', 'title', 'body']
};

// Columns that must stay text (stops "0012" becoming 12, keeps ISO dates as typed)
var TEXT_COLS = ['id', 'key', 'date', 'baId', 'baName', 'outletId', 'outletName', 'otherBrandName', 'reason',
  'reasonOther', 'lastSeen', 'locTime', 'activity', 'device', 'detail', 'type', 'state', 'role', 'status',
  'requestedBy', 'requestedByName', 'createdAt', 'updatedAt', 'resolvedBy', 'resolvedAt',
  'fromId', 'fromName', 'target', 'kind', 'title', 'body'];

function surveyJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function surveyRoute_(body) {
  var handlers = {
    surveyLogin: surveyLogin_,
    addSurvey: surveyAddSurvey_,
    ping: surveyPing_,
    flag: surveyFlag_,
    notifications: surveyNotifications_,
    outlets: surveyOutlets_,
    requestOutlet: surveyRequestOutlet_,
    managerData: surveyManagerData_,
    adminData: surveyAdminData_,
    saveUser: surveySaveUser_,
    saveOutlet: surveySaveOutlet_,
    importOutlets: surveyImportOutlets_,
    resolveFlag: surveyResolveFlag_,
    sendNotice: surveySendNotice_
  };
  var fn = body && handlers[body.action];
  if (!fn) return null;
  try { return fn(body); } catch (err) { return { ok: false, message: String(err && err.message || err) }; }
}

/* ---------- tokens ---------- */
// Signed with a secret kept in Script Properties, so a session can't be forged
// by editing the phone's storage.

function tokenSecret_() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('SURVEY_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('SURVEY_SECRET', s); }
  return s;
}

function sign_(text) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(text, tokenSecret_()));
}

function makeToken_(user) {
  var payload = [user.id, user.role, Date.now()].join('|');
  return Utilities.base64EncodeWebSafe(payload) + '.' + sign_(payload);
}

function readToken_(token) {
  if (!token || String(token).indexOf('.') < 0) return null;
  var parts = String(token).split('.');
  var payload;
  try { payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString(); } catch (e) { return null; }
  if (sign_(payload) !== parts[1]) return null;
  var p = payload.split('|');
  return { id: p[0], role: p[1] };
}

// Checks the token AND the current Users tab, so a deactivated or demoted
// account loses access straight away.
function requireUser_(token, roles) {
  var t = readToken_(token);
  if (!t) throw new Error('Session not valid. Sign in again.');
  var u = findUser_(t.id);
  if (!u || !u.active) throw new Error('This account is no longer active.');
  if (roles && roles.indexOf(u.role) < 0) throw new Error('This account does not have access to that.');
  return u;
}

/* ---------- users ---------- */

function usersTable_() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
  if (!sheet) throw new Error('Users tab not found.');
  var values = sheet.getDataRange().getValues();
  var head = values[0].map(function (h) { return String(h).trim().toLowerCase().replace(/[\s_]/g, ''); });
  var col = function (names) {
    for (var i = 0; i < names.length; i++) { var idx = head.indexOf(names[i]); if (idx > -1) return idx; }
    return -1;
  };
  var c = { user: col(['username', 'user', 'login']), pass: col(['password', 'pass', 'pin']),
    id: col(['id', 'userid', 'baid']), name: col(['name', 'fullname', 'baname']), role: col(['role', 'type']),
    active: col(['active', 'status']) };
  if (c.user < 0 || c.pass < 0) throw new Error('Users tab needs username and password columns.');
  var users = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var u = String(row[c.user]).trim();
    if (!u) continue;
    var role = c.role > -1 ? String(row[c.role]).trim().toLowerCase() : '';
    var act = c.active > -1 ? String(row[c.active]).trim().toLowerCase() : '';
    users.push({
      row: r + 1,
      username: u,
      password: String(row[c.pass]).trim(),
      id: c.id > -1 && row[c.id] !== '' ? String(row[c.id]).trim() : u,
      name: c.name > -1 && row[c.name] !== '' ? String(row[c.name]).trim() : u,
      role: role.indexOf('admin') > -1 ? 'admin' : role.indexOf('manager') > -1 ? 'manager' : 'ba',
      active: ['no', 'false', 'inactive', 'blocked', '0'].indexOf(act) < 0
    });
  }
  return { sheet: sheet, c: c, users: users };
}

function readUsers_() { return usersTable_().users; }

function findUser_(id) {
  var users = readUsers_();
  for (var i = 0; i < users.length; i++) if (users[i].id === String(id)) return users[i];
  return null;
}

function publicUser_(u) { return { id: u.id, name: u.name, username: u.username, role: u.role, active: u.active }; }

/* ---------- login ---------- */

function surveyLogin_(body) {
  var username = String(body.username || '').trim().toLowerCase();
  var password = String(body.password || '').trim().toLowerCase();
  if (!username || !password) return { ok: false, message: 'Enter your username and password.' };
  var loc = body.location || {};
  var users = readUsers_();
  var u = null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].username.toLowerCase() === username && users[i].password.toLowerCase() === password) { u = users[i]; break; }
  }
  if (!u) return { ok: false, message: 'Wrong username or password.' };
  if (!u.active) return { ok: false, message: 'This account is blocked. Contact your admin.' };
  if (body.need && body.need !== u.role) return { ok: false, message: 'This account is not an ' + body.need + ' account.' };
  // BAs can't sign in without a GPS fix. Managers and admins on a PC may not have one.
  if (u.role === 'ba' && (loc.lat == null || loc.lng == null)) return { ok: false, message: 'Location is required to sign in.', code: 'location' };

  withLock_(function () {
    appendByHeader_(sheet_(LOGINS_SHEET), {
      date: now_(), baId: u.id, baName: u.name, role: u.role,
      lat: num_(loc.lat), lng: num_(loc.lng), accuracy: num_(loc.accuracy), device: String(body.device || '').slice(0, 200)
    });
    if (u.role === 'ba') {
      upsertPresence_(u, { state: 'online', activity: 'Signed in', location: loc, device: body.device });
      appendTrack_(u, loc, 'Signed in');
    }
  });

  return { ok: true, user: { id: u.id, name: u.name, username: u.username, role: u.role, token: makeToken_(u) } };
}

/* ---------- heartbeat ---------- */

function surveyPing_(body) {
  var t = readToken_(body.token);
  if (!t) return { ok: false, message: 'Session not valid. Sign in again.' };
  var u = { id: t.id, name: String(body.baName || t.id), role: t.role };
  var loc = body.location || {};
  withLock_(function () {
    upsertPresence_(u, { state: body.state === 'offline' ? 'offline' : 'online', activity: body.activity, location: loc, device: body.device });
    if (loc.lat != null && loc.lng != null) appendTrack_(u, loc, body.activity);
  });
  if (body.state === 'offline') return { ok: true };
  // Piggy-back the bell and the outlet list version so the phone needs no extra calls
  return { ok: true, notes: notesFor_(u), outletsVersion: outletsVersion_() };
}

function surveyFlag_(body) {
  var t = readToken_(body.token);
  if (!t) return { ok: false, message: 'Session not valid.' };
  withLock_(function () {
    appendByHeader_(sheet_(FLAGS_SHEET), {
      id: 'FLG-' + Date.now() + '-' + Utilities.getUuid().slice(0, 4), date: now_(), baId: t.id,
      baName: String(body.baName || t.id), type: String(body.type || '').slice(0, 40),
      detail: String(body.detail || '').slice(0, 300), status: 'open'
    });
  });
  return { ok: true };
}

function upsertPresence_(u, p) {
  var sheet = sheet_(PRESENCE_SHEET);
  var loc = p.location || {};
  var row = { baId: u.id, baName: u.name, lastSeen: now_(), state: p.state, activity: String(p.activity || '').slice(0, 200) };
  if (p.device) row.device = String(p.device).slice(0, 200);
  if (loc.lat != null && loc.lng != null) {
    row.lat = num_(loc.lat); row.lng = num_(loc.lng); row.accuracy = num_(loc.accuracy);
    row.locTime = loc.at ? new Date(loc.at).toISOString() : now_();
  }
  if (!updateWhere_(sheet, 'baId', u.id, row)) appendByHeader_(sheet, row);
}

function appendTrack_(u, loc, activity) {
  if (loc.lat == null || loc.lng == null) return;
  appendByHeader_(sheet_(TRACK_SHEET), {
    date: now_(), baId: u.id, baName: u.name, lat: num_(loc.lat), lng: num_(loc.lng),
    accuracy: num_(loc.accuracy), activity: String(activity || '').slice(0, 200)
  });
}

/* ---------- notifications ---------- */

function surveyNotifications_(body) {
  var u = requireUser_(body.token);
  return { ok: true, notes: notesFor_(u) };
}

var FLAG_TEXT = { devtools: 'Developer tools detected', 'location-off': 'Location switched off', 'out-of-range': 'Survey away from outlet' };

function notesFor_(u) {
  var since = new Date(Date.now() - 30 * 864e5).toISOString();
  var notes = readRows_(NOTICES_SHEET, 400).filter(function (n) {
    var tg = String(n.target);
    return String(n.date) >= since && (tg === 'all' || tg === u.role || tg === 'user:' + u.id);
  }).map(function (n) {
    return { id: String(n.id), date: String(n.date), kind: String(n.kind || 'notice'), title: String(n.title), body: String(n.body || ''), from: String(n.fromName || '') };
  });
  if (u.role === 'manager' || u.role === 'admin') {
    var fSince = new Date(Date.now() - 14 * 864e5).toISOString();
    readRows_(FLAGS_SHEET, 300).forEach(function (f) {
      if (String(f.status) === 'resolved' || String(f.date) < fSince) return;
      notes.push({ id: 'flag:' + f.id, date: String(f.date), kind: 'flag', title: String(f.baName) + ': ' + (FLAG_TEXT[f.type] || f.type), body: String(f.detail || '') });
    });
  }
  if (u.role === 'admin') {
    readRows_(OUTLETS_SHEET, 0).forEach(function (o) {
      if (String(o.status) !== 'pending') return;
      notes.push({ id: 'req:' + o.key, date: String(o.createdAt), kind: 'request', title: 'New outlet request', body: String(o.outletName) + ' from ' + String(o.requestedByName) });
    });
  }
  notes.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  return notes.slice(0, 60);
}

function addNotice_(from, target, kind, title, body) {
  appendByHeader_(sheet_(NOTICES_SHEET), {
    id: 'NTF-' + Date.now() + '-' + Utilities.getUuid().slice(0, 4), date: now_(), fromId: from.id, fromName: from.name,
    target: target, kind: kind, title: String(title).slice(0, 120), body: String(body || '').slice(0, 1000)
  });
}

/* ---------- outlets ---------- */

function outletsVersion_() {
  return PropertiesService.getScriptProperties().getProperty('OUTLETS_VERSION') || '0';
}

function bumpOutlets_() {
  PropertiesService.getScriptProperties().setProperty('OUTLETS_VERSION', String(Date.now()));
}

function normId_(v) { return String(v || '').trim().toUpperCase().replace(/^'/, ''); }

// Active outlets for the phones. Sent as [id, name, lat, lng] to keep it small.
function surveyOutlets_(body) {
  requireUser_(body.token);
  var version = outletsVersion_();
  if (body.version && String(body.version) === version) return { ok: true, same: true, version: version };
  var list = readRows_(OUTLETS_SHEET, 0).filter(function (o) { return String(o.status) === 'active'; })
    .map(function (o) { return [normId_(o.outletId), String(o.outletName).replace(/^'/, ''), coord_(o.lat, 90), coord_(o.lng, 180)]; });
  return { ok: true, version: version, list: list };
}

function activeOutletMap_() {
  var map = {};
  readRows_(OUTLETS_SHEET, 0).forEach(function (o) { if (String(o.status) === 'active') map[normId_(o.outletId)] = o; });
  return map;
}

function surveyRequestOutlet_(body) {
  var u = requireUser_(body.token, ['ba', 'manager', 'admin']);
  var name = String(body.outletName || '').trim();
  var id = normId_(body.outletId);
  if (!name) return { ok: false, message: 'Enter the outlet name.' };
  if (id) {
    var hit = activeOutletMap_()[id];
    if (hit) return { ok: false, message: id + ' is already on the list as ' + hit.outletName + '.' };
  }
  var loc = body.location || {};
  withLock_(function () {
    appendByHeader_(sheet_(OUTLETS_SHEET), {
      key: 'OUT-' + Utilities.getUuid().slice(0, 8).toUpperCase(), outletId: id, outletName: name,
      status: 'pending', requestedBy: u.id, requestedByName: u.name,
      lat: num_(loc.lat), lng: num_(loc.lng), createdAt: now_(), updatedAt: now_()
    });
  });
  return { ok: true };
}

function surveySaveOutlet_(body) {
  var me = requireUser_(body.token, ['admin']);
  var o = body.outlet || {};
  var id = normId_(o.outletId);
  var name = String(o.outletName || '').trim();
  var status = ['active', 'inactive', 'pending', 'rejected'].indexOf(o.status) > -1 ? o.status : 'active';
  if (status !== 'rejected' && (!id || !name)) return { ok: false, message: 'Outlet ID and name are both required.' };

  var result = null;
  withLock_(function () {
    var sheet = sheet_(OUTLETS_SHEET);
    var rows = readRows_(OUTLETS_SHEET, 0);
    var clash = rows.filter(function (r) { return normId_(r.outletId) === id && r.key !== o.key && (r.status === 'active' || r.status === 'inactive'); })[0];
    if (id && status !== 'rejected' && clash) { result = { ok: false, message: id + ' is already used by ' + clash.outletName + '.' }; return; }
    var before = rows.filter(function (r) { return o.key && r.key === o.key; })[0];
    var row = { outletId: id, outletName: name, status: status, updatedAt: now_() };
    if (o.lat !== undefined) row.lat = coord_(o.lat, 90);
    if (o.lng !== undefined) row.lng = coord_(o.lng, 180);
    if (before) {
      updateWhere_(sheet, 'key', o.key, row);
      if (before.status === 'pending' && before.requestedBy) {
        if (status === 'active') addNotice_(me, 'user:' + before.requestedBy, 'approved', 'Outlet approved', name + ' (' + id + ') is on the list. You can survey it now.');
        if (status === 'rejected') addNotice_(me, 'user:' + before.requestedBy, 'rejected', 'Outlet request declined', String(before.outletName) + (o.reason ? ': ' + String(o.reason).slice(0, 300) : ''));
      }
    } else {
      row.key = 'OUT-' + Utilities.getUuid().slice(0, 8).toUpperCase();
      row.createdAt = now_();
      appendByHeader_(sheet, row);
    }
    bumpOutlets_();
    result = { ok: true, key: before ? o.key : row.key };
  });
  return result;
}

// Paste from the outlet master: one [id, name, lat, lng] per row. Existing IDs
// get their name and coordinates updated; new IDs are added as active.
function surveyImportOutlets_(body) {
  requireUser_(body.token, ['admin']);
  var rows = (body.rows || []).map(function (r) { return [normId_(r[0]), String(r[1] || '').trim(), coord_(r[2], 90), coord_(r[3], 180)]; })
    .filter(function (r) { return r[0] && r[1]; });
  var added = 0, updated = 0, skipped = (body.rows || []).length - rows.length;
  withLock_(function () {
    var sheet = sheet_(OUTLETS_SHEET);
    var headers = headers_(sheet);
    var existing = {};
    readRows_(OUTLETS_SHEET, 0).forEach(function (o) { if (o.status !== 'rejected' && o.outletId) existing[normId_(o.outletId)] = o; });
    var seen = {};
    var fresh = [];
    rows.forEach(function (r) {
      if (seen[r[0]]) { skipped++; return; }
      seen[r[0]] = true;
      var hit = existing[r[0]];
      if (hit) {
        var patch = {};
        if (String(hit.outletName) !== r[1]) patch.outletName = r[1];
        if (r[2] !== '' && r[3] !== '' && (Number(hit.lat) !== r[2] || Number(hit.lng) !== r[3])) { patch.lat = r[2]; patch.lng = r[3]; }
        if (Object.keys(patch).length) {
          patch.updatedAt = now_();
          updateWhere_(sheet, 'key', hit.key, patch);
          updated++;
        } else skipped++;
      } else {
        var o = { key: 'OUT-' + Utilities.getUuid().slice(0, 8).toUpperCase(), outletId: r[0], outletName: r[1], lat: r[2], lng: r[3], status: 'active', createdAt: now_(), updatedAt: now_() };
        fresh.push(headers.map(function (h) { return Object.prototype.hasOwnProperty.call(o, h) ? safe_(o[h]) : ''; }));
        added++;
      }
    });
    if (fresh.length) {
      var start = sheet.getLastRow() + 1;
      headers.forEach(function (h, i) { if (TEXT_COLS.indexOf(h) > -1) sheet.getRange(start, i + 1, fresh.length, 1).setNumberFormat('@'); });
      sheet.getRange(start, 1, fresh.length, headers.length).setValues(fresh);
    }
    bumpOutlets_();
  });
  return { ok: true, added: added, updated: updated, skipped: skipped };
}

/* ---------- addSurvey ---------- */

function surveyAddSurvey_(body) {
  var s = body.survey;
  if (!s || !s.outletId || !s.outletName) return { ok: false, message: 'Survey is missing the outlet.' };
  // The token travels inside the survey, so a queued survey is credited to the BA
  // who filled it even if someone else is signed in when it uploads.
  var t = readToken_(s.token);
  if (!t || t.id !== String(s.baId)) return { ok: false, message: 'Survey has no valid sign-in. Sign out and in again.' };

  // Once the outlet list is in use, a survey must name an active outlet, and the
  // name always comes from the list.
  var outletId = normId_(s.outletId);
  var outletName = String(s.outletName);
  var master = activeOutletMap_();
  var outlet = master[outletId];
  if (Object.keys(master).length) {
    if (!outlet) return { ok: false, message: 'Outlet ' + outletId + ' is not on the outlet list.' };
    outletName = String(outlet.outletName).replace(/^'/, '');
  }

  var ranks = s.ranks || {};
  var crates = s.crates || {};
  var loc = s.location || {};
  var row = {
    id: s.id || ('SRV-' + Date.now() + '-' + Utilities.getUuid().slice(0, 6).toUpperCase()),
    date: s.date || now_(),
    baId: s.baId, baName: s.baName || '',
    outletId: outletId, outletName: outletName,
    otherBrandName: s.otherBrandName || '',
    reason: s.reason || '', reasonOther: s.reasonOther || '',
    lat: num_(loc.lat), lng: num_(loc.lng), accuracy: num_(loc.accuracy), distanceM: ''
  };
  // How far the phone was from the outlet's coordinates when the survey was sent
  if (outlet && coord_(outlet.lat, 90) !== '' && coord_(outlet.lng, 180) !== '' && row.lat !== '' && row.lng !== '') {
    row.distanceM = Math.round(distanceM_(row.lat, row.lng, Number(outlet.lat), Number(outlet.lng)));
  }
  SURVEY_BRANDS.forEach(function (b) {
    row['rank' + b] = ranks[b] == null ? '' : Number(ranks[b]);     // blank = not sold, never 0
    row['crates' + b] = crates[b] == null ? '' : Number(crates[b]); // blank = unknown, never 0
  });

  var duplicate = false;
  withLock_(function () {
    var sheet = sheet_(SURVEY_SHEET);
    // A queued survey can be re-sent after a reply was lost. Same id = already saved.
    if (findRow_(sheet, 'id', row.id)) { duplicate = true; return; }
    appendByHeader_(sheet, row);
    if (row.distanceM !== '' && row.distanceM > OUTLET_RANGE_M) {
      appendByHeader_(sheet_(FLAGS_SHEET), {
        id: 'FLG-' + Date.now() + '-' + Utilities.getUuid().slice(0, 4), date: now_(), baId: String(row.baId), baName: String(row.baName),
        type: 'out-of-range', detail: outletName + ' (' + outletId + ') ' + row.distanceM + ' m away', status: 'open'
      });
    }
  });
  return { ok: true, id: row.id, duplicate: duplicate };
}

/* ---------- manager ---------- */

function surveyManagerData_(body) {
  var me = requireUser_(body.token, ['manager', 'admin']);
  var from = body.from ? String(body.from) : '';
  var trackFrom = body.trackFrom ? String(body.trackFrom) : new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  var bas = readUsers_().filter(function (u) { return u.role === 'ba' && u.active; })
    .map(function (u) { return { id: u.id, name: u.name, username: u.username }; });
  return {
    ok: true,
    serverTime: now_(),
    bas: bas,
    presence: readRows_(PRESENCE_SHEET, 0),
    surveys: readRows_(SURVEY_SHEET, 0).filter(function (r) { return !from || String(r.date) >= from; }),
    track: readRows_(TRACK_SHEET, 8000).filter(function (r) { return String(r.date) >= trackFrom; }),
    flags: readRows_(FLAGS_SHEET, 500).filter(function (r) { return String(r.date) >= trackFrom; }),
    notes: notesFor_(me)
  };
}

/* ---------- admin ---------- */

function surveyAdminData_(body) {
  var me = requireUser_(body.token, ['admin']);
  var since = new Date(Date.now() - 60 * 864e5).toISOString();
  var presence = {};
  readRows_(PRESENCE_SHEET, 0).forEach(function (p) { presence[p.baId] = String(p.lastSeen); });
  return {
    ok: true,
    serverTime: now_(),
    users: readUsers_().map(function (u) { var p = publicUser_(u); p.lastSeen = presence[u.id] || ''; return p; }),
    outlets: readRows_(OUTLETS_SHEET, 0).map(function (o) {
      return { key: o.key, outletId: normId_(o.outletId), outletName: String(o.outletName).replace(/^'/, ''), status: o.status,
        requestedBy: o.requestedBy, requestedByName: o.requestedByName, lat: o.lat, lng: o.lng, createdAt: o.createdAt, updatedAt: o.updatedAt };
    }),
    flags: readRows_(FLAGS_SHEET, 1000).filter(function (f) { return String(f.date) >= since; }),
    notices: readRows_(NOTICES_SHEET, 200).filter(function (n) { return n.kind === 'notice'; }),
    notes: notesFor_(me)
  };
}

function surveySaveUser_(body) {
  var me = requireUser_(body.token, ['admin']);
  var u = body.user || {};
  var username = String(u.username || '').trim();
  var name = String(u.name || '').trim();
  var id = String(u.id || '').trim() || username;
  var role = ROLES.indexOf(u.role) > -1 ? u.role : 'ba';
  var active = u.active !== false;
  var password = String(u.password || '').trim();
  if (!username || !name) return { ok: false, message: 'Name and username are required.' };
  if (/\s/.test(username)) return { ok: false, message: 'Usernames cannot contain spaces.' };

  var result = null;
  withLock_(function () {
    var t = usersTable_();
    // Make sure the optional columns exist before writing to them
    var need = [['id', 'id'], ['name', 'name'], ['role', 'role'], ['active', 'active']].filter(function (p) { return t.c[p[0]] < 0; });
    if (need.length) {
      var lastCol = t.sheet.getLastColumn();
      t.sheet.getRange(1, lastCol + 1, 1, need.length).setValues([need.map(function (p) { return p[1]; })]).setFontWeight('bold');
      t = usersTable_();
    }
    var editing = u.originalId ? t.users.filter(function (x) { return x.id === String(u.originalId); })[0] : null;
    if (u.originalId && !editing) { result = { ok: false, message: 'That user no longer exists.' }; return; }
    var clashName = t.users.filter(function (x) { return x !== editing && x.username.toLowerCase() === username.toLowerCase(); })[0];
    if (clashName) { result = { ok: false, message: 'Username ' + username + ' is already taken.' }; return; }
    var clashId = t.users.filter(function (x) { return x !== editing && x.id === id; })[0];
    if (clashId) { result = { ok: false, message: 'ID ' + id + ' is already used by ' + clashId.name + '.' }; return; }
    if (!editing && !password) { result = { ok: false, message: 'Set a password for the new user.' }; return; }
    if (editing && editing.id === me.id && (role !== 'admin' || !active)) { result = { ok: false, message: 'You cannot remove your own admin access.' }; return; }

    var r = editing ? editing.row : t.sheet.getLastRow() + 1;
    var put = function (ci, v) {
      if (ci < 0) return;
      var cell = t.sheet.getRange(r, ci + 1);
      cell.setNumberFormat('@');
      cell.setValue(v);
    };
    put(t.c.user, username);
    put(t.c.id, id);
    put(t.c.name, name);
    put(t.c.role, role === 'ba' ? 'BA' : role);
    put(t.c.active, active ? 'yes' : 'no');
    if (password) put(t.c.pass, password);
    result = { ok: true, id: id };
  });
  return result;
}

function surveyResolveFlag_(body) {
  var me = requireUser_(body.token, ['manager', 'admin']);
  var done = false;
  withLock_(function () {
    done = updateWhere_(sheet_(FLAGS_SHEET), 'id', String(body.id), { status: 'resolved', resolvedBy: me.name, resolvedAt: now_() });
  });
  return done ? { ok: true } : { ok: false, message: 'Flag not found.' };
}

function surveySendNotice_(body) {
  var me = requireUser_(body.token, ['admin']);
  var target = String(body.target || 'all');
  if (['all', 'ba', 'manager', 'admin'].indexOf(target) < 0 && target.indexOf('user:') !== 0) return { ok: false, message: 'Pick who should get it.' };
  if (!String(body.title || '').trim()) return { ok: false, message: 'Add a title.' };
  withLock_(function () { addNotice_(me, target, 'notice', String(body.title).trim(), String(body.body || '').trim()); });
  return { ok: true };
}

/* ---------- sheet helpers ---------- */

// Reads a tab as objects keyed by header. tail > 0 reads only the last N rows.
function readRows_(name, tail) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var headers = headers_(sheet);
  var last = sheet.getLastRow();
  var start = tail > 0 ? Math.max(2, last - tail + 1) : 2;
  var values = sheet.getRange(start, 1, last - start + 1, headers.length).getValues();
  return values.map(function (v) {
    var o = {};
    headers.forEach(function (h, i) { if (h) o[h] = v[i] instanceof Date ? v[i].toISOString() : v[i]; });
    return o;
  });
}

function sheet_(name) {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  var want = SHEET_HEADERS[name];
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, want.length).setValues([want]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else {
    // Add any new columns at the end. Existing columns are never moved or renamed.
    var have = headers_(sheet);
    var missing = want.filter(function (h) { return have.indexOf(h) < 0; });
    if (missing.length) sheet.getRange(1, have.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
  }
  return sheet;
}

function headers_(sheet) {
  return sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(function (h) { return String(h).trim(); });
}

function findRow_(sheet, header, value) {
  var col = headers_(sheet).indexOf(header) + 1;
  if (col < 1 || sheet.getLastRow() < 2) return 0;
  var hit = sheet.getRange(2, col, sheet.getLastRow() - 1, 1).createTextFinder(String(value)).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}

// Updates the given fields on the row where `header` equals `value`. Returns false if no row.
function updateWhere_(sheet, header, value, obj) {
  var r = findRow_(sheet, header, value);
  if (!r) return false;
  headers_(sheet).forEach(function (h, i) {
    if (!Object.prototype.hasOwnProperty.call(obj, h)) return;
    var cell = sheet.getRange(r, i + 1);
    if (TEXT_COLS.indexOf(h) > -1) cell.setNumberFormat('@');
    cell.setValue(safe_(obj[h]));
  });
  return true;
}

// Maps object keys onto header names. Column order does not matter. A renamed
// header means that field lands nowhere, so don't rename headers by hand.
function appendByHeader_(sheet, obj) {
  var headers = headers_(sheet);
  var values = headers.map(function (h) { return Object.prototype.hasOwnProperty.call(obj, h) ? safe_(obj[h]) : ''; });
  var r = sheet.getLastRow() + 1;
  headers.forEach(function (h, i) { if (TEXT_COLS.indexOf(h) > -1) sheet.getRange(r, i + 1).setNumberFormat('@'); });
  sheet.getRange(r, 1, 1, headers.length).setValues([values]);
}

// Free text starting with = + - @ would be read as a formula
function safe_(v) { return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v; }
function num_(v) { return v == null || v === '' || isNaN(Number(v)) ? '' : Number(v); }
// A latitude (limit 90) or longitude (limit 180), or blank if missing or impossible
function coord_(v, limit) {
  if (v == null || String(v).trim() === '') return '';
  var n = Number(String(v).trim().replace(',', '.'));
  return isNaN(n) || Math.abs(n) > limit || n === 0 ? '' : n;
}
function distanceM_(lat1, lng1, lat2, lng2) {
  var R = 6371000, toRad = Math.PI / 180;
  var dLat = (lat2 - lat1) * toRad, dLng = (lng2 - lng1) * toRad;
  var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
function now_() { return new Date().toISOString(); }

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { fn(); } finally { lock.releaseLock(); }
}

/* Run once from the editor: creates the tabs and approves permissions. */
function surveySetup() {
  Object.keys(SHEET_HEADERS).forEach(sheet_);
  tokenSecret_();
}
