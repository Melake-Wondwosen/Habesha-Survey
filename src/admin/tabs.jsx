import { useMemo, useState } from 'react'
import { importOutlets, resolveFlag, saveOutlet, saveUser, sendNotice } from '../api'
import { getUser } from '../storage'
import { Button, Field, Notice, Segmented, Sheet, Spinner, inputClass } from '../components/ui'

/* ---------- shared bits ---------- */

const hasLoc = (o) => o.lat !== '' && o.lat != null && o.lng !== '' && o.lng != null
const when = (iso) => (iso ? new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
const norm = (s) => String(s ?? '').toLowerCase()

function Search({ value, onChange, placeholder }) {
  return (
    <div className="relative flex-1 min-w-0">
      <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input className={`${inputClass} pl-11 min-h-[46px]`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

function Chip({ tone = 'plain', children }) {
  const t = {
    plain: 'bg-mist text-ink/75',
    gold: 'gold-gradient text-ink',
    dark: 'bg-ink text-paper',
    red: 'bg-ink text-gold',
    green: 'gold-gradient text-ink',
  }
  return <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap ${t[tone]}`}>{children}</span>
}

function Summary({ items }) {
  return (
    <div className={`grid gap-2.5 stagger mb-4 ${items.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
      {items.map((it, i) => (
        <div key={it.label} style={{ '--i': i }} className="lift rounded-2xl bg-white border border-ink/10 px-3 sm:px-4 py-3 min-w-0">
          <p className="font-serif text-2xl">{it.value}</p>
          <p className="text-[11px] uppercase tracking-wider text-gold-dark truncate">{it.label}</p>
        </div>
      ))}
    </div>
  )
}

function Empty({ children }) {
  return <p className="anim-fade rounded-2xl border border-dashed border-ink/20 px-4 py-10 text-center text-sm text-ink/55">{children}</p>
}

// Runs a save, shows errors inside the sheet, closes on success
function useSave(reload, say, onClose) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function run(fn, message) {
    setBusy(true)
    setError('')
    try {
      await fn()
      await reload()
      if (message) say(message)
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
  return { busy, error, run }
}

/* ---------- users ---------- */

const ROLE_LABEL = { ba: 'BA', manager: 'Manager', admin: 'Admin' }

export function UsersTab({ data, reload, say }) {
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const users = data.users
  const list = users
    .filter((u) => !q || [u.name, u.username, u.id, ROLE_LABEL[u.role]].some((v) => norm(v).includes(norm(q))))
    .sort((a, b) => b.active - a.active || a.role.localeCompare(b.role) || a.name.localeCompare(b.name))

  return (
    <>
      <Summary
        items={[
          { label: 'BAs', value: users.filter((u) => u.role === 'ba' && u.active).length },
          { label: 'Managers', value: users.filter((u) => u.role === 'manager' && u.active).length },
          { label: 'Admins', value: users.filter((u) => u.role === 'admin' && u.active).length },
          { label: 'Blocked', value: users.filter((u) => !u.active).length },
        ]}
      />
      <div className="flex gap-2.5 mb-3">
        <Search value={q} onChange={setQ} placeholder="Search" />
        <Button variant="gold" className="btn-hover w-auto! min-h-[46px] px-4 text-[15px] shrink-0" onClick={() => setEditing({})}>
          + Add
        </Button>
      </div>
      <ul className="rounded-2xl bg-white border border-ink/10 divide-y divide-ink/10 overflow-hidden stagger">
        {list.map((u, i) => (
          <li key={u.id} style={{ '--i': i }}>
            <button type="button" onClick={() => setEditing(u)} className="row-hover w-full text-left px-4 py-3 flex items-center gap-3">
              <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${u.active ? 'bg-ink text-paper' : 'bg-mist text-ink/40'}`}>
                {u.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block font-semibold truncate ${u.active ? '' : 'text-ink/45 line-through'}`}>{u.name}</span>
                <span className="block text-xs text-ink/55 truncate">
                  {u.username} · {u.id}
                  {u.lastSeen ? ` · seen ${when(u.lastSeen)}` : ''}
                </span>
              </span>
              <span className="flex flex-col sm:flex-row items-end sm:items-center gap-1">
                <Chip tone={u.role === 'admin' ? 'dark' : u.role === 'manager' ? 'gold' : 'plain'}>{ROLE_LABEL[u.role]}</Chip>
                {!u.active && <Chip tone="red">Blocked</Chip>}
              </span>
            </button>
          </li>
        ))}
        {!list.length && <li className="px-4 py-8 text-center text-sm text-ink/55">No users match.</li>}
      </ul>
      {editing && <UserSheet user={editing.id ? editing : null} reload={reload} say={say} onClose={() => setEditing(null)} />}
    </>
  )
}

function UserSheet({ user, reload, say, onClose }) {
  const me = getUser()
  const [f, setF] = useState({
    name: user?.name || '',
    username: user?.username || '',
    id: user?.id || '',
    role: user?.role || 'ba',
    password: '',
    active: user ? user.active : true,
  })
  const { busy, error, run } = useSave(reload, say, onClose)
  const put = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const self = user?.id === me.id

  return (
    <Sheet
      title={user ? 'Edit user' : 'Add user'}
      onClose={onClose}
      footer={
        <Button variant="gold" disabled={busy || !f.name.trim() || !f.username.trim() || (!user && !f.password.trim())} onClick={() => run(() => saveUser({ ...f, originalId: user?.id }), user ? `${f.name} updated` : `${f.name} added`)}>
          {busy ? <Spinner /> : user ? 'Save changes' : 'Add user'}
        </Button>
      }
    >
      <Field label="Full name">
        <input className={inputClass} value={f.name} onChange={put('name')} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Username">
          <input className={inputClass} value={f.username} onChange={put('username')} autoCapitalize="none" autoCorrect="off" spellCheck="false" />
        </Field>
        <Field label="Staff ID">
          <input className={`${inputClass} uppercase`} value={f.id} onChange={(e) => setF({ ...f, id: e.target.value.toUpperCase() })} />
        </Field>
      </div>
      <Field label="Role">
        <Segmented
          value={f.role}
          onChange={(role) => !self && setF({ ...f, role })}
          options={[
            { value: 'ba', label: 'BA' },
            { value: 'manager', label: 'Manager' },
            { value: 'admin', label: 'Admin' },
          ]}
        />
      </Field>
      <Field label="Password">
        <input className={inputClass} value={f.password} onChange={put('password')} autoComplete="new-password" placeholder={user ? 'Unchanged' : ''} />
      </Field>
      {!self && (
        <label className="flex items-center justify-between rounded-2xl bg-white border border-ink/10 px-4 py-3">
          <span className="font-semibold">Active</span>
          <Toggle on={f.active} onChange={(active) => setF({ ...f, active })} />
        </label>
      )}
      {error && <Notice>{error}</Notice>}
    </Sheet>
  )
}

function Toggle({ on, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`relative w-14 h-8 rounded-full shrink-0 ${on ? 'bg-gold' : 'bg-ink/20'}`}>
      <span className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)]" style={{ transform: on ? 'translateX(24px)' : 'none' }} />
    </button>
  )
}

/* ---------- outlets ---------- */

export function OutletsTab({ data, reload, say }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('active')
  const [limit, setLimit] = useState(60)
  const [editing, setEditing] = useState(null)
  const [importing, setImporting] = useState(false)
  const all = data.outlets.filter((o) => o.status === 'active' || o.status === 'inactive')
  const list = useMemo(
    () =>
      all
        .filter((o) => status === 'all' || o.status === status)
        .filter((o) => !q || [o.outletId, o.outletName].some((v) => norm(v).includes(norm(q))))
        .sort((a, b) => a.outletName.localeCompare(b.outletName)),
    [data, q, status],
  )

  return (
    <>
      <Summary
        items={[
          { label: 'Active', value: all.filter((o) => o.status === 'active').length.toLocaleString() },
          { label: 'Inactive', value: all.filter((o) => o.status === 'inactive').length.toLocaleString() },
          { label: 'No location', value: all.filter((o) => o.status === 'active' && !hasLoc(o)).length },
          { label: 'Requests', value: data.outlets.filter((o) => o.status === 'pending').length },
        ]}
      />
      <div className="flex flex-wrap gap-2.5 mb-3">
        <Search value={q} onChange={(v) => { setQ(v); setLimit(60) }} placeholder="Search" />
        <div className="flex gap-2.5 w-full sm:w-auto">
          <Button variant="ghost" className="btn-hover sm:w-auto! min-h-[46px] px-4 text-[15px]" onClick={() => setImporting(true)}>
            Import
          </Button>
          <Button variant="gold" className="btn-hover sm:w-auto! min-h-[46px] px-4 text-[15px]" onClick={() => setEditing({})}>
            + Add
          </Button>
        </div>
      </div>
      <Segmented
        className="mb-3 max-w-sm"
        value={status}
        onChange={(s) => { setStatus(s); setLimit(60) }}
        options={[
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'all', label: 'All' },
        ]}
      />
      {!all.length ? (
        <Empty>No outlets yet</Empty>
      ) : (
        <ul className="rounded-2xl bg-white border border-ink/10 divide-y divide-ink/10 overflow-hidden stagger">
          {list.slice(0, limit).map((o, i) => (
            <li key={o.key} style={{ '--i': i }}>
              <button type="button" onClick={() => setEditing(o)} className="row-hover w-full text-left px-4 py-3 grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[130px_minmax(0,1fr)_auto] gap-x-3 items-center">
                <span className="font-semibold text-gold-dark tracking-wide text-sm order-2 sm:order-none text-right sm:text-left">{o.outletId}</span>
                <span className="font-semibold truncate order-1 sm:order-none">{o.outletName}</span>
                <span className="order-3 sm:order-none justify-self-end col-span-2 sm:col-span-1 flex gap-1.5">
                  {!hasLoc(o) && <Chip>No location</Chip>}
                  {o.status === 'inactive' && <Chip tone="red">Inactive</Chip>}
                </span>
              </button>
            </li>
          ))}
          {!list.length && <li className="px-4 py-8 text-center text-sm text-ink/55">No outlets match.</li>}
        </ul>
      )}
      {list.length > limit && (
        <Button variant="ghost" className="mt-3" onClick={() => setLimit(limit + 100)}>
          Show more ({(list.length - limit).toLocaleString()} left)
        </Button>
      )}
      {editing && <OutletSheet outlet={editing.key ? editing : null} reload={reload} say={say} onClose={() => setEditing(null)} />}
      {importing && <ImportSheet reload={reload} say={say} onClose={() => setImporting(false)} />}
    </>
  )
}

function OutletSheet({ outlet, reload, say, onClose, approve }) {
  const [f, setF] = useState({
    outletId: outlet?.outletId || '',
    outletName: outlet?.outletName || '',
    lat: outlet?.lat ?? '',
    lng: outlet?.lng ?? '',
    status: approve ? 'active' : outlet?.status || 'active',
  })
  const { busy, error, run } = useSave(reload, say, onClose)
  const put = (k) => (e) => setF({ ...f, [k]: k === 'outletId' ? e.target.value.toUpperCase() : e.target.value })

  return (
    <Sheet
      title={approve ? 'Approve outlet' : outlet ? 'Edit outlet' : 'Add outlet'}
      onClose={onClose}
      footer={
        <Button
          variant="gold"
          disabled={busy || !f.outletId.trim() || !f.outletName.trim()}
          onClick={() => run(() => saveOutlet({ ...f, key: outlet?.key }), approve ? `${f.outletName} approved` : outlet ? `${f.outletName} saved` : `${f.outletName} added`)}
        >
          {busy ? <Spinner /> : approve ? 'Approve' : 'Save'}
        </Button>
      }
    >
      {approve && (
        <p className="text-sm text-ink/60">
          {outlet.requestedByName} · {when(outlet.createdAt)}
        </p>
      )}
      <Field label="Outlet ID">
        <input className={`${inputClass} uppercase tracking-wide`} value={f.outletId} onChange={put('outletId')} autoCapitalize="characters" />
      </Field>
      <Field label="Outlet name">
        <input className={inputClass} value={f.outletName} onChange={put('outletName')} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitude">
          <input className={inputClass} value={f.lat} onChange={put('lat')} inputMode="decimal" placeholder="9.0108" />
        </Field>
        <Field label="Longitude">
          <input className={inputClass} value={f.lng} onChange={put('lng')} inputMode="decimal" placeholder="38.7613" />
        </Field>
      </div>
      {f.lat !== '' && f.lng !== '' && (
        <a href={`https://maps.google.com/?q=${f.lat},${f.lng}`} target="_blank" rel="noreferrer" className="link-hover text-sm text-gold-dark">
          Check on map
        </a>
      )}
      {!approve && outlet && (
        <Field label="Status">
          <Segmented
            value={f.status}
            onChange={(status) => setF({ ...f, status })}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </Field>
      )}
      {error && <Notice>{error}</Notice>}
    </Sheet>
  )
}

// Accepts rows copied straight from Excel (tab separated) or CSV
function parseRows(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim())
  const rows = lines.map((l) => (l.includes('\t') ? l.split('\t') : l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)).map((c) => c.trim().replace(/^"|"$/g, '')))
  if (rows.length && /id/i.test(rows[0][0] || '') && /name/i.test(rows[0][1] || '')) rows.shift()
  return rows
}

function ImportSheet({ reload, say, onClose }) {
  const [text, setText] = useState('')
  const rows = useMemo(() => parseRows(text), [text])
  const valid = rows.filter((r) => r[0] && r[1])
  const { busy, error, run } = useSave(reload, say, onClose)

  return (
    <Sheet
      title="Import outlets"
      onClose={onClose}
      footer={
        <Button
          variant="gold"
          disabled={busy || !valid.length}
          onClick={() =>
            run(async () => {
              const r = await importOutlets(valid.map((v) => [v[0], v[1], v[2] ?? '', v[3] ?? '']))
              say(`Added ${r.added}, updated ${r.updated}, skipped ${r.skipped}`)
            }, null)
          }
        >
          {busy ? <Spinner /> : `Import ${valid.length ? valid.length.toLocaleString() : ''}`}
        </Button>
      }
    >
      <Field label="Outlet ID | Outlet name | Latitude | Longitude">
        <textarea className={`${inputClass} py-3 min-h-[200px] font-mono text-sm`} value={text} onChange={(e) => setText(e.target.value)} placeholder={'AA-1001\tAbebe Bar\t9.0108\t38.7613\nAA-1002\tSelam Grocery\t9.0214\t38.7466'} />
      </Field>
      {rows.length > 0 && (
        <div className="anim-fade rounded-2xl bg-white border border-ink/10 p-3 text-sm">
          <p className="font-semibold">
            {valid.length.toLocaleString()} ready{rows.length > valid.length ? ` · ${rows.length - valid.length} incomplete` : ''}
            {valid.some((r) => !r[2] || !r[3]) ? ` · ${valid.filter((r) => !r[2] || !r[3]).length} without location` : ''}
          </p>
          <ul className="mt-2 space-y-1 text-ink/70">
            {valid.slice(0, 4).map((r, i) => (
              <li key={i} className="truncate">
                <b className="text-gold-dark">{r[0].toUpperCase()}</b> {r[1]} {r[2] && <span className="text-ink/45">· {r[2]}, {r[3]}</span>}
              </li>
            ))}
            {valid.length > 4 && <li className="text-ink/45">+{(valid.length - 4).toLocaleString()}</li>}
          </ul>
        </div>
      )}
      {error && <Notice>{error}</Notice>}
    </Sheet>
  )
}

/* ---------- requests ---------- */

export function RequestsTab({ data, reload, say }) {
  const [approving, setApproving] = useState(null)
  const [declining, setDeclining] = useState(null)
  const pending = data.outlets.filter((o) => o.status === 'pending').sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
  const handled = data.outlets
    .filter((o) => o.requestedBy && (o.status === 'rejected' || o.status === 'active'))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 8)

  return (
    <>
      {!pending.length && <Empty>No requests</Empty>}
      <ul className="space-y-3 stagger">
        {pending.map((o, i) => (
          <li key={o.key} style={{ '--i': i }} className="lift rounded-2xl bg-white border border-gold/40 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-serif text-lg leading-tight">{o.outletName}</p>
                <p className="text-sm mt-0.5">
                  {o.outletId ? <b className="text-gold-dark tracking-wide">{o.outletId}</b> : <span className="text-ink/50">No ID</span>}
                </p>
                <p className="text-xs text-ink/50 mt-1.5">
                  {o.requestedByName} · {when(o.createdAt)}
                  {o.lat !== '' && o.lat != null && (
                    <>
                      {' · '}
                      <a href={`https://maps.google.com/?q=${o.lat},${o.lng}`} target="_blank" rel="noreferrer" className="link-hover text-gold-dark">
                        Map
                      </a>
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <Button variant="ghost" className="btn-hover min-h-[44px] text-[15px]" onClick={() => setDeclining(o)}>
                Decline
              </Button>
              <Button variant="gold" className="btn-hover min-h-[44px] text-[15px]" onClick={() => setApproving(o)}>
                Approve
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {handled.length > 0 && (
        <>
          <h3 className="font-serif text-lg mt-7 mb-2">Recent</h3>
          <ul className="rounded-2xl bg-white border border-ink/10 divide-y divide-ink/10">
            {handled.map((o) => (
              <li key={o.key} className="row-hover px-4 py-2.5 flex items-center gap-3 text-sm">
                <span className="flex-1 min-w-0 truncate">
                  <b>{o.outletName}</b> <span className="text-ink/50">· {o.requestedByName}</span>
                </span>
                <Chip tone={o.status === 'active' ? 'green' : 'red'}>{o.status === 'active' ? 'Approved' : 'Declined'}</Chip>
              </li>
            ))}
          </ul>
        </>
      )}

      {approving && <OutletSheet outlet={approving} approve reload={reload} say={say} onClose={() => setApproving(null)} />}
      {declining && <DeclineSheet outlet={declining} reload={reload} say={say} onClose={() => setDeclining(null)} />}
    </>
  )
}

function DeclineSheet({ outlet, reload, say, onClose }) {
  const [reason, setReason] = useState('')
  const { busy, error, run } = useSave(reload, say, onClose)
  return (
    <Sheet
      title="Decline"
      onClose={onClose}
      footer={
        <Button variant="danger" disabled={busy} onClick={() => run(() => saveOutlet({ ...outlet, status: 'rejected', reason }), 'Request declined')}>
          {busy ? <Spinner /> : 'Decline'}
        </Button>
      }
    >
      <p className="text-sm text-ink/60">
        {outlet.outletName} · {outlet.requestedByName}
      </p>
      <Field label="Reason">
        <textarea className={`${inputClass} py-3 min-h-[90px]`} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {error && <Notice>{error}</Notice>}
    </Sheet>
  )
}

/* ---------- alerts ---------- */

const FLAG_LABEL = { devtools: 'Developer tools detected', 'location-off': 'Location switched off', 'out-of-range': 'Survey away from outlet' }

export function FlagsTab({ data, reload, say }) {
  const [show, setShow] = useState('open')
  const [busy, setBusy] = useState('')
  const flags = data.flags
    .filter((f) => (show === 'open' ? f.status !== 'resolved' : f.status === 'resolved'))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))

  async function resolve(f) {
    setBusy(f.id)
    try {
      await resolveFlag(f.id)
      await reload()
      say('Alert resolved')
    } catch (err) {
      say(err.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <Segmented
        className="mb-3 max-w-xs"
        value={show}
        onChange={setShow}
        options={[
          { value: 'open', label: 'Open' },
          { value: 'resolved', label: 'Resolved' },
        ]}
      />
      {!flags.length && <Empty>No alerts</Empty>}
      <ul className="space-y-2.5 stagger">
        {flags.map((f, i) => (
          <li key={f.id || i} style={{ '--i': i }} className="lift rounded-2xl bg-white border border-ink/10 p-4 flex flex-wrap items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${f.status === 'resolved' ? 'bg-ink/25' : 'bg-gold'}`} />
            <span className="flex-1 min-w-[180px]">
              <span className="block font-semibold">
                {f.baName}: {FLAG_LABEL[f.type] || f.type}
              </span>
              <span className="block text-xs text-ink/55">
                {when(f.date)}
                {f.detail ? ` · ${f.detail}` : ''}
                {f.status === 'resolved' ? ` · resolved by ${f.resolvedBy}` : ''}
              </span>
            </span>
            {f.status !== 'resolved' && f.id && (
              <Button variant="ghost" className="btn-hover w-auto! min-h-[40px] px-4 text-sm" disabled={busy === f.id} onClick={() => resolve(f)}>
                {busy === f.id ? <Spinner /> : 'Resolve'}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

/* ---------- messages ---------- */

const AUDIENCE = { all: 'Everyone', ba: 'All BAs', manager: 'Managers', admin: 'Admins' }

export function MessagesTab({ data, reload, say }) {
  const [audience, setAudience] = useState('ba')
  const [person, setPerson] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const people = data.users.filter((u) => u.active).sort((a, b) => a.name.localeCompare(b.name))
  const target = audience === 'one' ? (person ? `user:${person}` : '') : audience
  const sent = [...data.notices].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  const nameOf = (t) => (String(t).startsWith('user:') ? people.find((p) => `user:${p.id}` === t)?.name || t.slice(5) : AUDIENCE[t] || t)

  async function send() {
    setBusy(true)
    setError('')
    try {
      await sendNotice(target, title, body)
      setTitle('')
      setBody('')
      await reload()
      say('Message sent')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-5 gap-5">
      <section className="lg:col-span-2 rounded-2xl bg-white border border-ink/10 p-4 space-y-4 self-start">
        <h3 className="font-serif text-lg">New message</h3>
        <Field label="Send to">
          <Segmented
            value={audience}
            onChange={setAudience}
            options={[
              { value: 'ba', label: 'BAs' },
              { value: 'manager', label: 'Managers' },
              { value: 'all', label: 'All' },
              { value: 'one', label: 'One' },
            ]}
          />
        </Field>
        {audience === 'one' && (
          <div className="anim-rise">
            <Field label="Person">
              <select className={inputClass} value={person} onChange={(e) => setPerson(e.target.value)}>
                <option value="">Choose…</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({ROLE_LABEL[p.role]})
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <Field label="Title">
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Message">
          <textarea className={`${inputClass} py-3 min-h-[110px]`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} />
        </Field>
        {error && <Notice>{error}</Notice>}
        <Button variant="gold" disabled={busy || !target || !title.trim()} onClick={send}>
          {busy ? <Spinner /> : 'Send'}
        </Button>
      </section>
      <section className="lg:col-span-3">
        <h3 className="font-serif text-lg mb-2">Sent</h3>
        {!sent.length && <Empty>No messages</Empty>}
        <ul className="space-y-2.5 stagger">
          {sent.map((n, i) => (
            <li key={n.id} style={{ '--i': i }} className="lift rounded-2xl bg-white border border-ink/10 p-4">
              <div className="flex items-baseline gap-3">
                <p className="flex-1 font-semibold">{n.title}</p>
                <span className="text-xs text-ink/45 shrink-0">{when(n.date)}</span>
              </div>
              {n.body && <p className="text-sm text-ink/70 mt-1 whitespace-pre-line">{n.body}</p>}
              <p className="text-[11px] uppercase tracking-wider text-gold-dark mt-2">
                {nameOf(n.target)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
