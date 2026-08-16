# Deployment & Environments

How Relax is built, where it runs, how staging and production
are separated, and exactly what happens on every push and release.

> Companion docs: [architecture.md](./architecture.md),
> [codebase.md](./codebase.md), [local-setup.md](./local-setup.md).

---

## 1. Where things run

| Concern | Provider |
|---|---|
| Hosting (SPA + serverless API) | **Vercel** (team `relax47`, project `personal-dashboard`) |
| Database | **Upstash Redis** (one DB, shared by prod + staging via key prefix) |
| Auth | **Clerk** |
| CI/CD | **GitHub Actions** (`.github/workflows/deploy.yml`) |
| Source | **GitHub** `reno47/Relax` |

There is **one** Vercel project. "Staging" is not a separate project — it is the
project's **Preview** environment. Environments are distinguished purely by
**per-environment environment variables**.

---

## 2. Environments

| Environment | Vercel env | Branch/trigger | Database namespace | Clerk keys |
|---|---|---|---|---|
| **Local** | — | your machine | JSON files in `data/users/` | dev instance |
| **Staging** | **Preview** | push/merge to the **`staging`** branch | `staging:` key prefix (same Upstash DB) | dev instance |
| **Production** | **Production** | publishing a GitHub **Release** (from `main`) | no prefix (same Upstash DB) | dev/live instance |

`staging` and `main` are **long-lived, protected** branches. Contributors never
commit to them directly — see [Branching model](#5-branching--promotion-model).

**Key isolation:** the serverless code prefixes every KV key with
`process.env.KV_KEY_PREFIX` (`api/_kv.ts → withPrefix`). Preview sets
`KV_KEY_PREFIX=staging:`; Production leaves it unset. So:

```
Production:  user:{id}:state
Staging:     staging:user:{id}:state
```

They live in the same Upstash database but never collide. ⚠️ **`KV_KEY_PREFIX`
must be Preview-only** — if it is ever set on Production, prod would look for
`staging:` keys and appear to "lose" all data.

---

## 3. The deploy pipeline (`.github/workflows/deploy.yml`)

One workflow, two jobs, each gated by the trigger:

```yaml
on:
  push:
    branches: [staging]     # → staging deploy
  release:
    types: [published]      # → production deploy
```

```mermaid
flowchart LR
  A["merge PR → staging"] --> S["staging job"]
  R["Publish GitHub Release"] --> P["production job"]

  subgraph S["staging job (Preview)"]
    s1["vercel pull --environment=preview"] --> s2["vercel build"] --> s3["vercel deploy --prebuilt"] --> s4["vercel alias → staging-personal-dashboard.vercel.app"]
  end
  subgraph P["production job (Production)"]
    p1["vercel pull --environment=production"] --> p2["vercel build --prod"] --> p3["vercel deploy --prebuilt --prod"]
  end
```

- Both jobs deploy via the **Vercel CLI**, which **bypasses** Vercel's Git
  auto-deploy. The project's **Ignored Build Step** is set to `exit 0` so Vercel
  never auto-builds on push — this workflow is the single source of deployment
  truth.
- The **staging** job aliases each Preview deployment to a stable URL
  (`staging-personal-dashboard.vercel.app`) so testers always hit the same link.
- The **production** job only runs when a **Release is published**.

### Required GitHub secrets
`VERCEL_TOKEN` (scoped to the `relax47` team), `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID`. (Values come from `vercel link` → `.vercel/project.json`.)

---

## 4. Vercel environment variables

Set under **Vercel → Project → Settings → Environment Variables**, scoped per
environment.

| Variable | Production | Preview (staging) | Sensitive? |
|---|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅ | ✅ | ❌ **must NOT be Sensitive** (build-time) |
| `CLERK_SECRET_KEY` | ✅ | ✅ | ok |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | ✅ | ✅ | ok |
| `KV_KEY_PREFIX` = `staging:` | ❌ | ✅ **Preview only** | — |
| `TFS_ENC_KEY` | ✅ (recommended) | ✅ | ok |
| `OWNER_USER_ID` | ✅ | ✅ | — |
| `AZDO_PAT` / `AZDO_ORG` | optional | optional | ok |

> **Why the "Sensitive" flag matters:** Vercel does not expose *Sensitive* env
> vars to `vercel pull` in CI. Because `VITE_CLERK_PUBLISHABLE_KEY` is baked into
> the browser bundle at build time, marking it Sensitive makes the CLI build
> receive an empty value → Clerk fails with "invalid publishableKey". Keep it
> non-sensitive (publishable keys are public anyway). Runtime-only secrets
> (`CLERK_SECRET_KEY`, PAT, KV token) can be Sensitive.

---

## 5. Branching & promotion model

Two protected long-lived branches, and short-lived work branches. Nobody pushes
directly to `staging` or `main` — everything goes through reviewed PRs.

```mermaid
flowchart LR
  f["work branch<br/>(any name)"] -->|"PR + review"| stg["staging (protected)"]
  stg -->|"auto deploy"| se["Staging URL"]
  stg -->|"Promote workflow (manual, SHA-pinned PR)"| main["main (protected)"]
  main -->|"Publish Release"| prod["Production"]
```

### Day-to-day flow
1. **Branch** off `staging` (any name, e.g. `feature/x`), develop, `npm run build`,
   test locally.
2. Open a **PR into `staging`** → review + green build required → merge.
3. Merging to `staging` **auto-deploys** to `staging-personal-dashboard.vercel.app`.
   Verify there.
4. **Promote:** run the **Promote staging → main** workflow
   (`.github/workflows/promote.yml`) — Actions → *Run workflow* → paste the exact
   **verified staging commit SHA**. Because direct pushes to `main` are blocked
   for everyone, the workflow pins that SHA to a `promote-to-main` branch, opens
   a **PR into `main`**, and enables **auto-merge** — so promotion still goes
   through the protected path.
   - Because you pass a **specific SHA**, a commit pushed to `staging` after you
     verified is **not** promoted (no accidental promotion / race).
   - The workflow refuses a SHA that isn't part of `staging` history.
   - Approve the promotion PR (and let required checks pass) → it auto-merges.
5. **Publish a GitHub Release** (tag `vX.Y.Z`, target `main`) → production deploys.
6. Verify production.

> Production is **not** auto-deployed when `main` changes — it deploys only on a
> published **Release**. Promotion and release are two deliberate steps.

### Branch protection

> ⚠️ **Free-tier reality:** GitHub does **not** enforce branch protection or
> rulesets on a **private** repo on the Free plan. Enforcement requires either a
> **public** repo or a **paid** plan (Pro / Team). This repo is free + private,
> so the rules below are **conventions backed by _soft guards_**, not
> server-enforced walls.

**Intended policy** (enforce for real by going public or paid — see table above):
- `main`: no direct pushes by anyone; changes arrive only via the Promote PR.
- `staging`: no direct pushes except the **owner**; contributors use PRs.

**Soft guards in this repo** (work on free + private):
- **`pre-push` hook** ([.githooks/pre-push](../.githooks/pre-push)) — rejects
  direct pushes to `main`/`staging` locally. Auto-installed by `npm install`
  (the `prepare` script sets `core.hooksPath`). Owner override for `staging`:
  `ALLOW_DIRECT_PUSH=1 git push origin staging`.
- **CI build check** ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) —
  runs `npm run build` on every PR into `staging`/`main`; reviewers gate merges
  on the green check by convention.
- **Direct-push guard**
  ([.github/workflows/guard-direct-push.yml](../.github/workflows/guard-direct-push.yml))
  — opens a tracking issue if a push to `main`/`staging` has no PR reference.
  Best-effort alert; it can't block the push.

> The Promote workflow still opens a **PR + auto-merge** into `main` (rebase), so
> promotion mirrors the intended flow. Enable **Settings → General → Allow
> auto-merge** and **rebase merging**.

### Versioning history (context)
- `v1.0.0` baseline, `v2.0.0` feature set.
- `v3.0.0` multi-tenant productization (Clerk auth, per-user isolation, owner
  data migration, sample data, per-user TFS PAT, staging).
- `v3.0.1` cleanup (removed one-time migration code + old global KV keys).
- `v3.0.2` removed the in-app feedback button.
- `v3.1.0` profile menu + light theme.
- `v3.2.0` TFS assigned work items + filters + state chips.
- `v3.2.1` mandatory area path + docs.
- `v3.2.2` rebrand to Relax.

---

## 6. Staging data & rehearsal tooling

Because staging shares the Upstash DB (behind the `staging:` prefix), several
scripts help manage it (run with the KV credentials set in your shell):

| Task | Command |
|---|---|
| Seed synthetic data for a staging user | `npm run seed:staging` (reset: `node scripts/seed-staging.mjs --reset`) |
| Rehearse a data migration into staging | `npm run rehearse:migration` |
| Back up legacy global keys | `npm run backup:global` |
| Delete legacy global keys | `node scripts/delete-global.mjs --confirm` |

---

## 7. Rollback

- **Fast path:** in the Vercel dashboard, open **Deployments**, find a previous
  healthy **Production** deployment, and **Promote/Rollback** to it.
- **Via release:** re-publishing (or re-running the production job for) an earlier
  release rebuilds that commit.
- Data is stored per-user in Upstash and is independent of the app version;
  rolling back the code does not roll back user data.

---

## 8. Observability & troubleshooting

- **Build/deploy logs:** GitHub → **Actions** → the *Deploy* workflow run.
- **Runtime (function) logs:** Vercel → the deployment → **Logs** (Runtime). This
  is where `/api/*` errors (e.g. `ERR_MODULE_NOT_FOUND`, Azure `404`) surface.
- **Client errors:** the browser console (e.g. Clerk key problems).

Common issues and causes:

| Symptom | Likely cause |
|---|---|
| "invalid publishableKey" in the browser | `VITE_CLERK_PUBLISHABLE_KEY` missing/malformed or marked **Sensitive**; rebuild after fixing. |
| `/api/*` 500 `ERR_MODULE_NOT_FOUND` | A relative import in `api/` missing the `.js` extension (ESM). |
| Prod shows no data after deploy | `KV_KEY_PREFIX` accidentally set on Production. |
| TFS assigned empty, `wiqlStatus: 404` | Wrong org slug, or WIQL called org-level (must be project-scoped). |
| Staging job didn't run on push | Branch not matching `feature/**` / `productization`, or missing Vercel secrets. |

> Do **not** commit compiled artifacts. `api/*.js` and `api/*.d.ts` are
> git-ignored; if the TS project ever emits them, remove them (a stale
> `api/_tfscore.js` can shadow the `.ts` at build time).
