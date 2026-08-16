import { createClient } from '@vercel/kv'

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
const confirm = process.argv.includes('--confirm')
const includeStaging = process.argv.includes('--staging')

if (!url || !token) {
  console.error('\nMissing KV credentials (set KV_REST_API_URL / KV_REST_API_TOKEN).\n')
  process.exit(1)
}
if (!confirm) {
  console.error('\nRefusing to delete without --confirm. Back up first: npm run backup:global\n')
  process.exit(1)
}

const kv = createClient({ url, token })
const keys = ['dashboard:state', 'calendar:data']
if (includeStaging) keys.push('staging:dashboard:state', 'staging:calendar:data')

async function main() {
  for (const k of keys) {
    await kv.del(k)
    console.log(`deleted ${k}`)
  }
  console.log('Done.')
}

main().catch((e) => {
  console.error(e?.message ?? String(e))
  process.exit(1)
})
