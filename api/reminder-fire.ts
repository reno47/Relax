import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getKv } from './_kv.js'
import { baseUrlFrom, fireReminder, verifyQstashSignature } from './_reminders.js'

function rawBody(req: VercelRequest): string {
  if (typeof req.body === 'string') return req.body
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8')
  // We publish compact JSON with string/number values, so re-serialising is byte-identical.
  return req.body ? JSON.stringify(req.body) : ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  const body = rawBody(req)
  const signature = req.headers['upstash-signature']
  if (!verifyQstashSignature(Array.isArray(signature) ? signature[0] : signature, body)) {
    return res.status(401).json({ error: 'Invalid signature.' })
  }
  const kv = await getKv()
  if (!kv) return res.status(501).json({ error: 'Storage not configured.' })

  const { u, r, at } = JSON.parse(body) as { u?: string; r?: string; at?: number }
  if (!u || !r || typeof at !== 'number') return res.status(400).json({ error: 'Bad payload.' })

  const outcome = await fireReminder(kv, u, r, at, baseUrlFrom(req))
  // A non-2xx makes QStash retry delivery.
  if (outcome === 'failed') return res.status(502).json({ outcome })
  return res.status(200).json({ outcome })
}
