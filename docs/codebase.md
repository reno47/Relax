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
│   ├── _github.ts           # GitHub credential resolution + GraphQL client
│   ├── _githubcore.ts       # Contribution calendar + PR stats
│   ├── _myprscore.ts        # Open/draft PR search (pure, shared with dev server)
│   ├── _remindercore.ts     # Reminder model, repeat maths, Teams cards (pure, shared with dev server)
│   ├── _reminders.ts        # Reminder storage, QStash scheduling, Teams delivery
│   ├── state.ts             # GET/POST dashboard state blob
│   ├── calendar.ts          # GET/POST calendar blob
│   ├── tfs.ts               # Single work-item lookup by ID
│   ├── tfs-settings.ts      # GET/POST/DELETE TFS connection (org/area/PAT)
│   ├── tfs-assigned.ts      # GET assigned work items
│   ├── github-settings.ts   # GET/POST/DELETE GitHub connection (PAT/org)
│   ├── github-contributions.ts # GET contributions for a date range
│   ├── github-prs.ts        # GET my open + draft PRs
│   ├── reminders.ts         # GET/POST/PATCH/DELETE reminders
│   ├── teams-settings.ts    # GET/POST/DELETE Teams webhook, send test
│   ├── reminder-fire.ts     # QStash callback → post to Teams
│   └── cron-reminders.ts    # Daily safety-net sweep (Vercel Cron)
├── src/
│   ├── main.tsx             # App bootstrap (ClerkProvider, theme apply)
│   ├── App.tsx              # Auth gate + tab router
│   ├── index.css            # Design tokens (light/dark themes)
│   ├── lib/syncStore.ts     # localStorage ⇄ server sync engine
│   ├── lib/badgeEvents.ts   # in-page events that keep the Reminder badge live
│   ├── hooks/
│   │   ├── useLocalStorage.ts  # synced local state
│   │   ├── useTheme.ts         # theme state (light/dark)
│   │   └── useReminderBadge.ts # open to-dos + overdue reminders count
│   ├── data/links.ts        # generic sample/default content
│   └── components/
│       ├── Navbar.tsx           # top navigation + Reminder badge + UserMenu
│       ├── UserMenu.tsx         # avatar → email / theme / GitHub Contributions / logout
│       ├── SampleBanner.tsx     # onboarding "sample data" banner
│       ├── profile/             # GitHub Contributions + My Open PRs pages
│       └── sections/            # one folder for all tab features
├── scripts/                 # ops scripts (seed/backup/migrate) — Node .mjs
├── vercel.json              # Vercel Cron for /api/cron-reminders
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
- Holds a `page` state (`'contributions' | 'prs' | null`) for full-page views
  (GitHub Contributions, My Open PRs). Clicking any nav tab closes the page.

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
  "dashboard.portals.sections": [ ...Section ],
  "dashboard.notes.sections":  [ ...NoteSection ],
  "dashboard.todos":           [ ...Todo ],
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
- The **My Open PRs** button (next to *+ Add section*) opens the My Open PRs page
  (see §6a).

### Infra — `Infra.tsx`
- Data key: `dashboard.infra.sections` = `Section[]` (`{ id, title, items }`).
- Seeded from `links.ts` defaults, then fully user-managed.

### Important Portals — `Portals.tsx`
- Data key: `dashboard.portals.sections` = `Section[]`. Old
  `dashboard.portals.items` / `.custom` data is migrated into sections on first
  load.

### Calendar — `Calendar.tsx`
- **Own endpoint** `/api/calendar` (not the state blob).
- Categories (`{ id, name, color }`) + marks (`dateKey → categoryId`, dateKey =
  `YYYY-MM-DD`). Paint days by clicking; summary counts per category/year;
  JSON backup/restore built in.

### Reminder — `Reminder.tsx`
Two tabs (last one remembered in `reminder.tab`):
- **To-Do** (`TodoList.tsx`) — `useLocalStorage('dashboard.todos')`, so it syncs
  like any dashboard key. Ticking strikes an item through; completed items are
  pruned 24h later (checked every minute).
- **Reminders** (`RemindersList.tsx`, `ReminderForm.tsx`, `TeamsSettings.tsx`) —
  server-backed via `useReminders.ts` (`/api/reminders`, refreshed every 60s).
  Date/time, repeat (none/daily/weekdays/weekly/monthly), snooze, edit, tick,
  delete. Fired one-off reminders stay visible until ticked or deleted.
  `TeamsSettings` stores the Teams Workflows webhook and can send a test card.
- `reminderUtils.ts` holds formatting helpers; styles in `reminder.css` (`rm-*`).

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
- The **Reminder** tab shows a red badge = open to-dos + overdue reminders
  (`useReminderBadge`). `TodoList` and `useReminders` emit in-page events
  (`badgeEvents.ts`) so the count updates instantly.
- UserMenu dropdown: **email** (header) → **Theme** sub-panel (Light/Dark) →
  **GitHub Contributions** → **Logout**. Theme changes call
  `useTheme().setTheme` (synced).

### 6a. Profile pages — `src/components/profile/`
- **GitHub Contributions** (`GithubContributions.tsx`) — connection
  (`GithubSettings.tsx`, `/api/github-settings`), month-range filters,
  contribution heatmap, PR stats per repo, language pie, and the open-PR list.
- **My Open PRs** (`MyPrsPage.tsx` → `MyOpenPrs.tsx` + `useMyPrs.ts`) — calls
  `/api/github-prs`; All/Open/Draft filters, review status chip, age (≥14 days
  highlighted as stale). Styles in `myPrs.css` (`mpr-*`).

### `SampleBanner.tsx`
- New/empty accounts see generic sample content (from `links.ts`) and an
  onboarding banner. **"Got it"** dismisses it; **"Clear sample data"** wipes all
  tabs + calendar. The dismissal flag `dashboard.onboardingDismissed` is a synced
  key, so it persists per account across devices.

---

## 7. The API (`/api`)

All handlers first call `getUserId(req)`; a missing/invalid token → `401`
(except `reminder-fire.ts`, authenticated by the QStash signature, and
`cron-reminders.ts`, authenticated by `CRON_SECRET`).

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
| `_github.ts` | — | `resolveGithubCredentials(userId)` + `githubGraphQL()`. |
| `_githubcore.ts` | — | `fetchContributions(creds, from, to)`. |
| `_myprscore.ts` | — | `fetchMyOpenPrs(gql, org)` — pure; the GraphQL function is injected. |
| `_remindercore.ts` | — | Reminder types, `nextOccurrence`, `applyAction`, webhook allow-list, Teams card builders — pure. |
| `_reminders.ts` | — | KV load/save, QStash publish/cancel, `fireReminder`, QStash signature check. |
| `github-settings.ts` | GET/POST/DELETE | Manage the GitHub connection; verifies the PAT; **GET never returns it**. |
| `github-contributions.ts` | GET | Contribution calendar + PR stats for `?from=&to=`. |
| `github-prs.ts` | GET | The user's open + draft PRs (in the saved org). |
| `reminders.ts` | GET/POST/PATCH/DELETE | Reminder CRUD; PATCH actions: `complete`, `uncomplete`, `snooze`, `edit`. Returns `{ reminders, teamsConfigured }`. |
| `teams-settings.ts` | GET/POST/DELETE | Save the Teams webhook (encrypted) or `{ test: true }` to send a test card. |
| `reminder-fire.ts` | POST | QStash callback (signature-verified, no user JWT) — delivers one reminder. |
| `cron-reminders.ts` | GET | Daily cron (Bearer `CRON_SECRET`) — fire overdue, book upcoming. |

Files prefixed with `_` are **not** treated as routes by Vercel (shared helpers).
Relative imports inside `api/` **must** carry a `.js` extension (Vercel runs them
as ESM) — e.g. `import { getUserId } from './_auth.js'`.

`_remindercore.ts` and `_myprscore.ts` have **no imports** so `vite.config.ts`
can reuse them for the local dev API; they are listed in `tsconfig.node.json`.

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
