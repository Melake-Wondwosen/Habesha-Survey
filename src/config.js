// Apps Script web app URL. Same /exec URL as the wheel app.
// If the backend is ever redeployed to a new URL, change it here AND in the wheel app.
export const API_URL = 'https://script.google.com/macros/s/PASTE_YOUR_DEPLOYMENT_ID/exec'

// Demo builds (vite --mode demo) never call the server.
export const DEMO = import.meta.env.MODE === 'demo'

// Screen order. `key` becomes the sheet column suffix: rankHabesha, cratesHabesha, ...
export const BRANDS = [
  { key: 'Habesha', label: 'Habesha', ours: true },
  { key: 'Harar', label: 'Harar' },
  { key: 'Dashen', label: 'Dashen' },
  { key: 'Bedele', label: 'Bedele' },
  { key: 'StGeorge', label: 'St. George' },
  { key: 'Meta', label: 'Meta' },
  { key: 'Other', label: 'Other' },
]

// Step 4. The exact strings land in the `reason` column, so edit with care
// once fieldwork has started. Keep "Other" last.
export const REASON_QUESTION = 'Main reason the top brand sells most here'
export const REASONS = [
  'Price',
  'Taste',
  'Customer loyalty to the brand',
  'Always in stock',
  'Promotions and offers',
  'Supplier credit or terms',
  'Other',
]

// BAs only see outlets whose coordinates are within this distance of their phone
export const OUTLET_RANGE_M = 100

export const RETURN_HOME_MS = 1700
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
