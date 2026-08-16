# Codebase Guide

A detailed, file-by-file walkthrough of the entire codebase: every feature, how
it is implemented, and — importantly — how data moves from the UI into the
database and back.

> Companion docs: [architecture.md](./architecture.md) (system design + full DB
> structure), [deployment.md](./deployment.md), [local-setup.md](./local-setup.md).

---

## 1. Tech stack

- **Vite 5** (`^5.4.11`) — dev server + bundler.
- **React 18** (`^18.3.1`) + **TypeScript 5.9** — SPA UI.
- **Clerk** (`@clerk/clerk-react`, `@clerk/backend`) — auth.
- **Upstash Redis** via `@vercel/kv` — database.
- **Vercel Serverless Functions** (`@vercel/node`) — the API.

Build command: `tsc -b && vite build`. Dev: `npm run dev`.

---

## 2. Repository layout

```
.
├── api/                     # Vercel serverless functions (the backend)
│   ├── _auth.ts             # Clerk JWT verification → userId
│   ├── _kv.ts               # Upstash client + withPrefix() (staging namespace)
│   ├── _crypto.ts           # AES-256-GCM encrypt/decrypt (for PATs)
│   ├── _tfs.ts              # TFS credential resolution (per-user + owner fallback)
│   ├── _tfscore.ts          # Azure DevOps "assigned items" logic (pure)
│   ├── state.ts             # GET/POST dashboard state blob
│   ├── calendar.ts          # GET/POST calendar blob
│   ├── tfs.ts               # Single work-item lookup by ID
│   ├── tfs-settings.ts      # GET/POST/DELETE TFS connection (org/area/PAT)
│   └── tfs-assigned.ts      # GET assigned work items
├── src/
│   ├── main.tsx             # App bootstrap (ClerkProvider, theme apply)
│   ├── App.tsx              # Auth gate + tab router
│   ├── index.css            # Design tokens (light/dark themes)
│   ├── lib/syncStore.ts     # localStorage ⇄ server sync engine
│   ├── hooks/
│   │   ├── useLocalStorage.ts  # synced local state
│   │   └── useTheme.ts         # theme state (light/dark)
│   ├── data/links.ts        # generic sample/default content
│   └── components/
│       ├── Navbar.tsx           # top navigation + UserMenu
│       ├── UserMenu.tsx         # avatar → email / theme / logout
│       ├── SampleBanner.tsx     # onboarding "sample data" banner
│       └── sections/            # one folder for all tab features
├── scripts/                 # ops scripts (seed/backup/migrate) — Node .mjs
├── vite.config.ts           # dev server + local /api middleware
└── docs/                    # this documentation
```

---

## 3. Application bootstrap

### `src/main.tsx`
- Reads `VITE_CLERK_PUBLISHABLE_KEY`. If missing, renders a "Setup needed" notice
  (so a misconfigured deploy fails loudly rather than silently).
- Applies the saved theme (`applyTheme(readStoredTheme())`) **before** first
  render to avoid a flash of the wrong theme.
- Wraps the app in `<ClerkProvider>`.

### `src/App.tsx`
- Uses Clerk's `<SignedOut>` / `<SignedIn>` to gate the whole UI: signed-out users
  only see the Clerk `<SignIn/>` screen.
- Registers the auth token getter for the sync engine:
  `setAuthTokenGetter(() => getToken())` so plain modules can attach the JWT.
- Holds the active tab (`dashboard.activeSection` in localStorage) and renders the
  matching section component.

---

## 4. State & synchronisation (the core mechanism)

### `src/hooks/useLocalStorage.ts`
A `useState`-like hook backed by localStorage **and** the server:
- Initial value comes from localStorage (or a provided default).
- On mount it `subscribe`s to the key and triggers `hydrate()`.
- On every change it writes to localStorage and calls `schedulePush()`.

### `src/lib/syncStore.ts` — the sync engine
- **Which keys sync:** `key.startsWith('dashboard.') && !key.startsWith('dashboard.calendar.')`.
  (Calendar is excluded because it has its own endpoint.)
- **`hydrate()`** — runs once; `GET /api/state`; for each returned key writes the
  JSON into localStorage and notifies subscribers.
- **`schedulePush()`** — waits for hydrate, then debounces (~700 ms) and calls
  `pushNow()`.
- **`pushNow()`** — iterates localStorage, collects every synced key, and
  `POST`s a single object to `/api/state`.
- Auth: `authHeaders()` attaches `Authorization: Bearer <jwt>` using the getter
  registered by `App.tsx`.

**How data is pushed & in what format (concretely):**

```jsonc
// POST /api/state  body:
{
  "dashboard.tfs.boards":      [ ...LinkItem[] ],
  "dashboard.tfs.workitems":   [ ...WorkItem[] ],
  "dashboard.github.sections": [ [ ...Section ], ... ],
  "dashboard.infra.sections":  [ ...Section ],
  "dashboard.portals.items":   [ ...LinkItem ],
  "dashboard.notes.sections":  [ ...NoteSection ],
  "dashboard.activeSection":   "tfs",
  "dashboard.theme":           "dark",
  "dashboard.onboardingDismissed": true
}
```
The server stores this object **verbatim** at `user:{id}:state` in Upstash. See
[architecture.md](./architecture.md#3-database-structure-upstash-redis--kv) for
the full stored formats.

### `src/hooks/useTheme.ts`
- `useLocalStorage<Theme>('dashboard.theme', 'dark')` → so the theme **syncs
  across devices** like any other dashboard key.
- An effect sets `data-theme="light|dark"` on `<html>`; CSS variables in
  `index.css` do the rest.

---

## 5. Features (per tab)

All tab components live in `src/components/sections/`. Each persists via
`useLocalStorage`, so it is automatically cached locally **and** synced to the DB.

### TFS — `TFS.tsx`
The richest tab. It combines:
1. **Boards & backlog links** (`dashboard.tfs.boards`, `LinkItem[]`).
2. **Azure DevOps connection** (`TfsSettings.tsx`) — org + area + PAT; all three
   required to connect. Saved via `/api/tfs-settings` (PAT encrypted server-side).
3. **Assigned work items** — `useAssignedWorkItems.ts` fetches `/api/tfs-assigned`
   on tab open, on manual **Refresh**, and every 5 min (paused when the tab is
   hidden).
4. **Manual lookup by ID** (`TfsLookup.tsx`) — calls `/api/tfs?id=...`; added items
   persist in `dashboard.tfs.workitems`.
5. **Merge + display** — assigned (live) + manual (persisted) items are merged by
   id (assigned wins), grouped by iteration, and **sorted descending** (current
   iteration on top). Each card shows a **state chip** (`tfsUtils.stateClass`).
6. **Filters** (`TfsFilters.tsx`) — Feature/Story/Bug chips + iteration dropdown.

`tfsUtils.ts` provides: `leafIteration`, `typeClass`, `typeBucket`
(Feature/Story/Bug), `stateClass` (colour buckets for states), and the shared
`WorkItem` / `AssignedItem` / `IterationOption` types.

### GitHub — `GitHub.tsx`
- Data key: `dashboard.github.sections` = **6 columns**, each an array of
  collapsible sections `{ id, title, items: LinkItem[] }`.
- Supports drag-and-drop reordering; legacy keys (`layout/order/custom/removed`)
  are read once to migrate old users into the sections model.

### Infra — `Infra.tsx`
- Data key: `dashboard.infra.sections` = `Section[]` (`{ id, title, items }`).
- Seeded from `links.ts` defaults, then fully user-managed.

### Important Portals — `Portals.tsx`
- Data key: `dashboard.portals.items` = `LinkItem[]`.

### Calendar — `Calendar.tsx`
- **Own endpoint** `/api/calendar` (not the state blob).
- Categories (`{ id, name, color }`) + marks (`dateKey → categoryId`, dateKey =
  `YYYY-MM-DD`). Paint days by clicking; summary counts per category/year;
  JSON backup/restore built in.

### Notes — `Notes.tsx` + `NoteEditor.tsx`
- Data key: `dashboard.notes.sections` = `NoteSection[]`
  (`{ id, name, pages: NotePage[] }`, `NotePage = { id, title, html, date? }`).
- Rich-text editor via `contentEditable` (bold/italic/underline, sizes, colours,
  pasted images inlined as data URLs).

### Shared UI
- `AddItemForm.tsx` / `ItemEditForm.tsx` — add/edit a link (title/url/description).
- `Shared.tsx` — `Hero`, `RemovableCard`.
- `ConfirmDialog.tsx` — themed replacement for `window.confirm`.

---

## 6. Cross-cutting UI

### `Navbar.tsx` + `UserMenu.tsx`
- Navbar has the tab buttons and the **UserMenu** (top-right avatar).
- UserMenu dropdown: **email** (header) → **Theme** sub-panel (Light/Dark) →
  **Logout**. Theme changes call `useTheme().setTheme` (synced).

### `SampleBanner.tsx`
- New/empty accounts see generic sample content (from `links.ts`) and an
  onboarding banner. **"Got it"** dismisses it; **"Clear sample data"** wipes all
  tabs + calendar. The dismissal flag `dashboard.onboardingDismissed` is a synced
  key, so it persists per account across devices.

---

## 7. The API (`/api`)

All handlers first call `getUserId(req)`; a missing/invalid token → `401`.

| File | Method(s) | Purpose |
|---|---|---|
| `_auth.ts` | — | `verifyToken` (Clerk) → `userId`. |
| `_kv.ts` | — | `getKv()` (Upstash client) + `withPrefix(key)` for staging. |
| `_crypto.ts` | — | AES-256-GCM `encryptSecret` / `decryptSecret`. |
| `_tfs.ts` | — | `resolveTfsCredentials(userId)` → `{ org, pat, area }` from KV, with owner env fallback. |
| `_tfscore.ts` | — | `fetchAssigned(org, pat, area)` — the Azure DevOps assigned-items pipeline. |
| `state.ts` | GET/POST | Read/write `user:{id}:state`. |
| `calendar.ts` | GET/POST | Read/write `user:{id}:calendar`. |
| `tfs.ts` | GET | Look up one work item by numeric id. |
| `tfs-settings.ts` | GET/POST/DELETE | Manage the TFS connection; **GET never returns the PAT**. |
| `tfs-assigned.ts` | GET | Return assigned Feature/Story/Bug items + iterations. |

Files prefixed with `_` are **not** treated as routes by Vercel (shared helpers).
Relative imports inside `api/` **must** carry a `.js` extension (Vercel runs them
as ESM) — e.g. `import { getUserId } from './_auth.js'`.

---

## 8. Operations scripts (`scripts/`)

Node ESM scripts run with the KV credentials in the environment:

| Script | npm | Purpose |
|---|---|---|
| `seed-staging.mjs` | `npm run seed:staging` | Populate/reset synthetic data for a staging user. |
| `rehearse-migration.mjs` | `npm run rehearse:migration` | Copy prod global blob into the staging namespace (migration rehearsal). |
| `backup-global.mjs` | `npm run backup:global` | Dump legacy global keys to `backups/*.json`. |
| `delete-global.mjs` | `npm run delete:global` | Delete legacy global keys (requires `--confirm`). |

> npm swallows some flags after `--`; run flagged scripts directly, e.g.
> `node scripts/delete-global.mjs --confirm`.

---

## 9. Conventions

- **Types:** prefer `type`; co-locate; never `any`.
- **Exports:** named exports (no default) except the section components / Navbar.
- **Styling:** CSS files per component using the **design tokens** in `index.css`
  (never hard-code colours — that keeps light/dark working).
- **No secrets in the client:** only `VITE_*` values reach the browser.
