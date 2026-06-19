// Lightweight server sync for all `dashboard.*` localStorage keys.
//
// On first use it hydrates from `/api/state` (Vercel KV in prod, a JSON file
// in dev) and writes the values into localStorage, notifying any subscribed
// hooks so the UI updates. On every change it debounce-pushes a snapshot of
// all `dashboard.*` keys back to the server.
//
// Calendar keys (`dashboard.calendar.*`) are intentionally excluded — the
// calendar has its own dedicated `/api/calendar` endpoint.

const ENDPOINT = '/api/state'

function isSynced(key: string): boolean {
  return key.startsWith('dashboard.') && !key.startsWith('dashboard.calendar.')
}

const listeners = new Map<string, Set<(value: unknown) => void>>()
let hydratePromise: Promise<void> | null = null
let pushTimer: ReturnType<typeof setTimeout> | undefined

export function subscribe(key: string, fn: (value: unknown) => void): () => void {
  let set = listeners.get(key)
  if (!set) {
    set = new Set()
    listeners.set(key, set)
  }
  set.add(fn)
  return () => {
    set!.delete(fn)
  }
}

// Fetch the server snapshot once and apply it to localStorage + subscribers.
export function hydrate(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (hydratePromise) return hydratePromise

  hydratePromise = fetch(ENDPOINT)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || typeof data !== 'object') return
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (!isSynced(key) || value === undefined || value === null) continue
        try {
          localStorage.setItem(key, JSON.stringify(value))
        } catch {
          /* ignore */
        }
        listeners.get(key)?.forEach((fn) => fn(value))
      }
    })
    .catch(() => {
      /* offline or store not configured — keep using localStorage */
    })

  return hydratePromise
}

// Debounced push of every synced key currently in localStorage. Waits for the
// initial hydrate so we never overwrite newer server data with stale local data.
export function schedulePush(): void {
  if (typeof window === 'undefined') return
  hydrate().then(() => {
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(pushNow, 700)
  })
}

function pushNow(): void {
  const snapshot: Record<string, unknown> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !isSynced(key)) continue
    try {
      snapshot[key] = JSON.parse(localStorage.getItem(key) as string)
    } catch {
      /* skip unparseable values */
    }
  }
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  }).catch(() => {
    /* ignore network errors — localStorage still holds the data */
  })
}
