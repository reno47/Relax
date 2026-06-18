import type { VercelRequest, VercelResponse } from '@vercel/node'

// Persists the calendar to Vercel KV (Upstash Redis) when configured.
// If KV env vars are not set, the endpoint degrades gracefully and the
// frontend keeps using localStorage (data still survives a refresh per-browser).
const KEY = 'calendar:data'

async function getKv() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null
  const { kv } = await import('@vercel/kv')
  return kv
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const kv = await getKv()

  if (req.method === 'GET') {
    if (!kv) {
      res.status(200).json({ categories: null, marks: null })
      return
    }
    const data = (await kv.get(KEY)) ?? { categories: null, marks: null }
    res.status(200).json(data)
    return
  }

  if (req.method === 'POST') {
    if (!kv) {
      // No store configured — tell the client it wasn't persisted server-side.
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
