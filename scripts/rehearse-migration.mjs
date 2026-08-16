import { createClient } from '@vercel/kv'

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
const prefix = process.env.KV_KEY_PREFIX || 'staging:'
const reset = process.argv.includes('--reset')

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

if (!url || !token) fail('Missing KV credentials (set KV_REST_API_URL / KV_REST_API_TOKEN).')

const kv = createClient({ url, token })
const pairs = [
  { from: 'dashboard:state', to: `${prefix}dashboard:state` },
  { from: 'calendar:data', to: `${prefix}calendar:data` },
]

async function main() {
  if (reset) {
    for (const { to } of pairs) await kv.del(to)
    console.log(`✔ Removed staging global copies (${prefix}dashboard:state, ${prefix}calendar:data).`)
    return
  }
  for (const { from, to } of pairs) {
    const blob = await kv.get(from)
    if (!blob) {
      console.log(`• ${from} is empty — skipped.`)
      continue
    }
    await kv.set(to, blob)
    console.log(`✔ Copied ${from} → ${to}`)
  }
  console.log('\nNow sign in as the owner on staging to trigger the migration.')
}

main().catch((e) => fail(e?.message ?? String(e)))
