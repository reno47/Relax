import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@vercel/kv'

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

if (!url || !token) {
  console.error('\nMissing KV credentials (set KV_REST_API_URL / KV_REST_API_TOKEN).\n')
  process.exit(1)
}

const kv = createClient({ url, token })
const keys = ['dashboard:state', 'calendar:data', 'staging:dashboard:state', 'staging:calendar:data']

async function main() {
  const dump = {}
  for (const k of keys) dump[k] = (await kv.get(k)) ?? null
  const dir = path.resolve('backups')
  fs.mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file = path.join(dir, `global-backup-${stamp}.json`)
  fs.writeFileSync(file, JSON.stringify(dump, null, 2), 'utf8')
  const present = keys.filter((k) => dump[k] !== null)
  console.log(`Backed up ${present.length}/${keys.length} keys to ${path.relative('.', file)}`)
  for (const k of keys) console.log(`  ${dump[k] !== null ? 'present' : 'absent '}  ${k}`)
}

main().catch((e) => {
  console.error(e?.message ?? String(e))
  process.exit(1)
})
