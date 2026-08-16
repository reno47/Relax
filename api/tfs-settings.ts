import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserId } from './_auth.js'
import { getKv, withPrefix } from './_kv.js'
import { encryptSecret } from './_crypto.js'

type StoredTfs = { org: string; pat: string; area?: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const kv = await getKv()
  if (!kv) {
    res.status(501).json({ error: 'Storage not configured.' })
    return
  }
  const key = withPrefix(`user:${userId}:tfs`)

  if (req.method === 'GET') {
    const stored = await kv.get<StoredTfs>(key)
    res.status(200).json({ configured: Boolean(stored?.pat), org: stored?.org ?? null, area: stored?.area ?? null })
    return
  }

  if (req.method === 'POST') {
    const { pat, org, area } = (req.body ?? {}) as { pat?: string; org?: string; area?: string }
    const orgVal = (org ?? '').trim()
    const areaVal = (area ?? '').trim()
    if (!pat?.trim()) {
      res.status(400).json({ error: 'Provide a Personal Access Token.' })
      return
    }
    if (!orgVal) {
      res.status(400).json({ error: 'Provide your Azure DevOps organization.' })
      return
    }
    if (!areaVal) {
      res.status(400).json({ error: 'Provide an area path.' })
      return
    }
    await kv.set(key, {
      org: orgVal,
      pat: encryptSecret(pat.trim()),
      area: areaVal,
    } satisfies StoredTfs)
    res.status(200).json({ configured: true, org: orgVal, area: areaVal })
    return
  }

  if (req.method === 'DELETE') {
    await kv.del(key)
    res.status(200).json({ configured: false, org: null, area: null })
    return
  }

  res.status(405).json({ error: 'Method not allowed.' })
}
