import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserId } from './_auth.js'
import { getKv, withPrefix } from './_kv.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const key = withPrefix(`user:${userId}:calendar`)
  const kv = await getKv()

  if (req.method === 'GET') {
    if (!kv) {
      res.status(200).json({ categories: null, marks: null })
      return
    }
    const data = (await kv.get(key)) ?? { categories: null, marks: null }
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
