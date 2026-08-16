# Local Setup & Contributing

A step-by-step guide for a new collaborator to run Relax locally and contribute
changes.

> Companion docs: [architecture.md](./architecture.md),
> [codebase.md](./codebase.md), [deployment.md](./deployment.md).

---

## 1. What you need

### Tools
- **Node.js 20+** and npm (the CI uses Node 20).
- **Git**.
- A code editor (VS Code recommended).

### Accounts / credentials
- **Clerk** account (free) — to get a **publishable** and **secret** key for a
  development instance. Auth cannot run without these.
- *(Optional)* **Azure DevOps** Personal Access Token (PAT) with **Work Items
  (Read)** scope — only needed to exercise the TFS features.
- You do **not** need Upstash or Vercel for local development — the dev server
  stores data as local JSON files.

> Local dev does not verify the Clerk JWT signature (it only decodes it) and does
> not touch the production database, so a Clerk **development** instance is all
> you need.

---

## 2. Clone & install

```powershell
git clone https://github.com/reno47/Relax.git
cd Relax
npm install
```

---

## 3. Configure environment variables

Copy the example file and fill it in:

```powershell
Copy-Item .env.example .env
```

Minimum required for the app to load and let you sign in:

```dotenv
# From Clerk Dashboard → API Keys (a development instance)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
```

Optional (only for TFS features via the owner fallback path):

```dotenv
OWNER_USER_ID=user_xxx      # your Clerk user id (Clerk Dashboard → Users)
AZDO_PAT=...                # Azure DevOps PAT, Work Items (Read)
# AZDO_ORG=your-org
# TFS_ENC_KEY=              # optional; only used by the cloud API
```

Notes:
- `VITE_*` variables are read by the **browser build**; the rest by the local
  **API middleware**. Restart `npm run dev` after changing any of them.
- `.env` is git-ignored — never commit real keys.

### Clerk configuration
1. Create a Clerk application (development instance).
2. Copy the **Publishable key** and **Secret key** into `.env`.
3. Sign-up is **invite-only** in production, but for local dev you can enable
   sign-ups on your own dev instance so you can create test accounts freely.

---

## 4. Run it

```powershell
npm run dev
```

Open the printed URL (typically `http://localhost:5173`). Sign in with Clerk, and
you'll land on the dashboard.

Other scripts:

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server (with the local `/api` middleware). |
| `npm run build` | Type-check (`tsc -b`) and produce a production build. |
| `npm run preview` | Serve the production build locally. |

Always run `npm run build` before pushing — it is the same check CI runs.

---

## 5. How local data works (important mental model)

There is **no cloud** locally. `vite.config.ts` implements the `/api/*` routes as
dev middleware and stores each user's data as JSON files:

```
data/users/{yourClerkUserId}/state.json      # dashboard state
data/users/{yourClerkUserId}/calendar.json   # calendar
data/users/{yourClerkUserId}/tfs.json        # TFS org/area/PAT
```

- Your data persists across restarts because it's on disk.
- Each Clerk user gets their own folder (per-user isolation, mirroring prod).
- The whole `data/` folder is git-ignored.
- To reset yourself to a "new user", delete your folder under `data/users/`.

The TFS endpoints call the **real Azure DevOps API** with your stored PAT, so TFS
features work fully offline from Vercel.

---

## 6. Trying each feature locally

- **GitHub / Infra / Portals / Notes / Calendar** — work immediately; edits save
  to your local JSON files.
- **Theme** — user menu (top-right avatar) → Theme → Light/Dark. Persists.
- **TFS** — open the TFS tab → *Azure DevOps connection* → enter **Organization**,
  **PAT**, and **Area path** (all required), e.g. `Healthcare IT\CVI Reporting`.
  Your assigned Feature/Story/Bug items appear, grouped by iteration, with filters.

Quick API check from the browser console (after signing in):

```js
const t = await window.Clerk.session.getToken();
const r = await fetch('/api/tfs-assigned', { headers: { Authorization: 'Bearer ' + t } });
console.log(r.status, await r.json());
```

---

## 7. Contribution workflow

We use two protected long-lived branches — **`staging`** (integration) and
**`main`** (production) — and short-lived work branches. You never push directly
to `staging` or `main`.

1. **Branch** off `staging`:
   ```powershell
   git fetch origin
   git checkout -b feature/your-change origin/staging
   ```
2. **Make changes** following the conventions below.
3. **Build locally:** `npm run build` (must pass — it's a required check).
4. **Open a Pull Request into `staging`.** After review + a green build, it's
   merged.
5. Merging to `staging` **auto-deploys** to
   `staging-personal-dashboard.vercel.app` — verify your change there.
6. A maintainer **promotes** the verified staging commit to `main` via the manual
   **Promote staging → main** GitHub Action, then **publishes a Release** to
   deploy production. See
   [deployment.md](./deployment.md#5-branching--promotion-model).

> Production deploys only on a published Release — never automatically on a merge.

### Coding conventions
- **TypeScript:** prefer `type` over `interface`; never use `any`; co-locate
  types.
- **Exports:** named exports (no default) except section components / `Navbar`.
- **Styling:** use the CSS design tokens in `src/index.css` (`var(--...)`); never
  hard-code colours, so light/dark themes keep working.
- **API files (`api/`):** relative imports **must** end in `.js` (Vercel runs
  them as ESM), e.g. `import { getKv } from './_kv.js'`. Files starting with `_`
  are shared helpers, not routes.
- Do **not** commit `.env`, anything under `data/`, `backups/`, or compiled
  `api/*.js` / `*.d.ts` artifacts (all git-ignored).

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| Blank page / "Setup needed" | `VITE_CLERK_PUBLISHABLE_KEY` missing in `.env`; restart dev server after adding. |
| "invalid publishableKey" | The key value is wrong/typo'd; re-copy from Clerk. |
| Can't sign in | Ensure your Clerk **dev** instance allows sign-ups (for testing). |
| TFS shows nothing | Check org spelling, that the **Area path** is set, and that the PAT has *Work Items (Read)*. |
| Changed `.env` but nothing happened | Restart `npm run dev` (env + Vite config are read at startup). |
| Want a clean "new user" state | Delete your folder under `data/users/`. |

---

## 9. Where to look next

- Understand the system → [architecture.md](./architecture.md).
- Find where a feature lives → [codebase.md](./codebase.md).
- Ship a change → [deployment.md](./deployment.md).
