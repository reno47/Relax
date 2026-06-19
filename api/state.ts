import type { VercelRequest, VercelResponse } from '@vercel/node'

// Persists all `dashboard.*` UI state (TFS/GitHub/Infra/Portals customisations,
// ordering and deletions) to Vercel KV when configured. If KV env vars are not
// set, the endpoint degrades gracefully and the frontend keeps using
// localStorage (data still survives a refresh per-browser).
const KEY = 'dashboard:state'

async function getKv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const { createClient } = await import('@vercel/kv')
  return createClient({ url, token })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const kv = await getKv()

  if (req.method === 'GET') {
    if (!kv) {
      res.status(200).json({})
      return
    }
    const data = (await kv.get(KEY)) ?? {}
    res.status(200).json(data)
    return
  }

  if (req.method === 'POST') {
    if (!kv) {
      res.status(200).json({ ok: true, stored: false })
      return
    }
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      await kv.set(KEY, body)
      res.status(200).json({ ok: true, stored: true })
    } catch {
      res.status(400).json({ ok: false })
    }
    return
  }

  res.status(405).end()
}
