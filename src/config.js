// Apps Script web app URL (the survey app's own backend, see apps-script/Survey.gs).
// Paste the URL ending in /exec from Deploy > New deployment > Web app.
export const API_URL = 'https://script.google.com/macros/s/AKfycbzOH6x8uhYrmM3jfoTxUnltLzPEIPro-02D-18Bj02KLC_IRyYZm3ne9lZJk10lZypcUg/exec'

// Demo builds (vite --mode demo) never call the server.
export const DEMO = import.meta.env.MODE === 'demo'

// Screen order. `key` becomes the sheet column suffix: rankHabesha, cratesHabesha, ...
export const BRANDS = [
  { key: 'BGI', label: 'BGI' },
  { key: 'Heineken', label: 'Heineken' },
  { key: 'Dashen', label: 'Dashen' },
  { key: 'Habesha', label: 'Habesha', ours: true },
  { key: 'Anbesa', label: 'Anbesa' },
  { key: 'Kegna', label: 'Kegna' },
]

// Step 4: Habesha visibility. `key` becomes the sheet column: posmABSPoster, ...
export const VISIBILITY_ITEMS = [
  { key: 'ABSPoster', label: 'ABS poster' },
  { key: 'PaperPoster', label: 'Paper poster' },
  { key: 'BottleCutout', label: 'Bottle cutout' },
  { key: 'Banner', label: 'Banner' },
  { key: 'TableCloth', label: 'Table cloth' },
  { key: 'LEDLight', label: 'LED light' },
  { key: 'Fridge', label: 'Fridge' },
]

// BAs only see outlets whose coordinates are within this distance of their phone
export const OUTLET_RANGE_M = 100

export const RETURN_HOME_MS = 1200
export const REQUEST_TIMEOUT_MS = 20000

// Presence. A BA's phone reports location and activity this often while the app is open.
export const PING_MS = 3 * 60 * 1000
// Counted as online if the last report is newer than this
export const ONLINE_MS = 7 * 60 * 1000
// Manager dashboard refresh
export const MANAGER_REFRESH_MS = 60 * 1000
// Two location points further apart than this speed get flagged as a jump
export const JUMP_KMH = 150

// Lock the app when developer tools are attached. Off while running `npm run dev`.
export const LOCK_DEVTOOLS = !import.meta.env.DEV
