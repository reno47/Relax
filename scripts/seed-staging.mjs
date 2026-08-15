// Seed or reset STAGING data with synthetic sample content so staging mirrors a
// real, populated account. Staging shares the same Upstash DB as production but
// is isolated by a key prefix (default "staging:"), so production keys (which
// are unprefixed) are never touched.
//
// Usage (PowerShell):
//   $env:SEED_USER_ID = "user_xxx"            # a Clerk user id in the staging Clerk instance
//   $env:KV_REST_API_URL = "https://<db>.upstash.io"
//   $env:KV_REST_API_TOKEN = "<token>"
//   npm run seed:staging                       # populate  (keys: staging:user:...)
//   npm run seed:staging -- --reset            # clear this user's staging data
//
// KV_KEY_PREFIX overrides the namespace (must match the Preview env's prefix).
import { createClient } from '@vercel/kv'

const url =
  process.env.STAGING_KV_REST_API_URL ||
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL
const token =
  process.env.STAGING_KV_REST_API_TOKEN ||
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN

const userId = process.env.SEED_USER_ID
const reset = process.argv.includes('--reset')

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

if (!url || !token) fail('Missing KV credentials (set STAGING_KV_REST_API_URL / _TOKEN).')
if (!userId) fail('Missing SEED_USER_ID (a Clerk user id in the staging instance).')

const kv = createClient({ url, token })
const prefix = process.env.KV_KEY_PREFIX || 'staging:'
const stateKey = `${prefix}user:${userId}:state`
const calendarKey = `${prefix}user:${userId}:calendar`

const state = {
  'dashboard.tfs.boards': [
    { title: 'Sprint Board', url: 'https://dev.azure.com', description: 'Active sprint' },
    { title: 'Product Backlog', url: 'https://dev.azure.com', description: 'Prioritised items' },
  ],
  'dashboard.tfs.workitems': [
    {
      id: 100234,
      title: 'Staging: sample work item',
      iteration: 'Demo\\PI1\\Sprint 2',
      type: 'User Story',
      url: 'https://dev.azure.com',
    },
  ],
  'dashboard.github.sections': [
    [{ id: 'seed-core', title: 'My Repos', items: [
      { title: 'my-portfolio', url: 'https://github.com', description: 'Personal site' },
      { title: 'dotfiles', url: 'https://github.com', description: 'Config' },
    ] }],
    [{ id: 'seed-team', title: 'Team', items: [
      { title: 'react', url: 'https://github.com/facebook/react', description: 'UI library' },
    ] }],
    [], [], [], [],
  ],
  'dashboard.infra.sections': [
    { id: 'aws', title: 'AWS', items: [{ title: 'AWS Console', url: 'https://console.aws.amazon.com' }] },
    { id: 'argocd', title: 'Argo CD', items: [{ title: 'Argo CD', url: 'https://argo-cd.readthedocs.io' }] },
  ],
  'dashboard.portals.items': [
    { title: 'Office 365', url: 'https://www.office.com', description: 'Mail & docs' },
    { title: 'Learning', url: 'https://www.linkedin.com/learning', description: 'Courses' },
  ],
  'dashboard.notes.sections': [
    {
      id: 'seed-general',
      name: 'Staging notes',
      pages: [
        {
          id: 'seed-welcome',
          title: 'Welcome to staging',
          html: '<p>This is <b>synthetic</b> staging data seeded by <code>seed-staging.mjs</code>.</p>',
        },
      ],
    },
  ],
}

const calendar = {
  categories: [
    { id: 'pl', name: 'PL', color: '#4f9cff' },
    { id: 'wfa', name: 'WFA', color: '#a371f7' },
  ],
  marks: {
    '2026-08-18': 'pl',
    '2026-08-19': 'pl',
    '2026-08-25': 'wfa',
  },
}

async function main() {
  if (reset) {
    await kv.del(stateKey)
    await kv.del(calendarKey)
    console.log(`✔ Cleared staging data for ${userId}.`)
    return
  }
  await kv.set(stateKey, state)
  await kv.set(calendarKey, calendar)
  console.log(`✔ Seeded staging data for ${userId}.`)
  console.log(`  ${stateKey}`)
  console.log(`  ${calendarKey}`)
}

main().catch((e) => fail(e?.message ?? String(e)))
