import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserId } from './_auth'
import { getKv, withPrefix } from './_kv'
import { migrateOwnerIfNeeded } from './_migrate'

// Persists a signed-in user's `dashboard.*` UI state to Vercel KV under a
// per-user key (`user:{id}:state`). Requires a valid Clerk token. On the
// owner's first read, migrates the pre-multitenant global blob into their space.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const key = withPrefix(`user:${userId}:state`)
  const kv = await getKv()

  if (req.method === 'GET') {
    if (!kv) {
      res.status(200).json({})
      return
    }
    await migrateOwnerIfNeeded(kv, userId)
    const data = (await kv.get(key)) ?? {}
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
      await kv.set(key, body)
      res.status(200).json({ ok: true, stored: true })
    } catch {
      res.status(400).json({ ok: false })
    }
    return
  }

  res.status(405).end()
}
