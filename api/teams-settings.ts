import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserId } from './_auth.js'
import { getKv } from './_kv.js'
import { encryptSecret } from './_crypto.js'
import { postToTeams, teamsKey, teamsUrl, type StoredTeams } from './_reminders.js'
import { buildTestCard, isAllowedWebhook } from './_remindercore.js'

const BAD_URL = 'Paste the HTTPS webhook URL from your Teams Workflows "Send webhook alerts" flow.'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  const kv = await getKv()
  if (!kv) return res.status(501).json({ error: 'Storage not configured.' })
  const key = teamsKey(userId)

  if (req.method === 'GET') {
    return res.status(200).json({ configured: Boolean(await kv.get<StoredTeams>(key)) })
  }

  if (req.method === 'POST') {
    const { url, test } = (req.body ?? {}) as { url?: string; test?: boolean }
    if (test) {
      const stored = await teamsUrl(kv, userId)
      if (!stored) return res.status(400).json({ error: 'Connect Teams first.' })
      const ok = await postToTeams(stored, buildTestCard())
      return ok
        ? res.status(200).json({ configured: true })
        : res.status(502).json({ error: 'Teams did not accept the message. Check the workflow is on.' })
    }
    const value = (url ?? '').trim()
    if (!isAllowedWebhook(value)) return res.status(400).json({ error: BAD_URL })
    await kv.set(key, { url: encryptSecret(value) } satisfies StoredTeams)
    return res.status(200).json({ configured: true })
  }

  if (req.method === 'DELETE') {
    await kv.del(key)
    return res.status(200).json({ configured: false })
  }

  return res.status(405).json({ error: 'Method not allowed.' })
}
