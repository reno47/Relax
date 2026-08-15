import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserId } from './_auth'
import { getKv, withPrefix } from './_kv'
import { encryptSecret } from './_crypto'

// Per-user Azure DevOps connection settings. Stores the organization and an
// encrypted PAT under `user:{userId}:tfs`. The PAT is never returned to the
// browser — GET only reports whether a token is configured.
type StoredTfs = { org: string; pat: string } // `pat` is encrypted at rest

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
    res.status(200).json({ configured: Boolean(stored?.pat), org: stored?.org ?? null })
    return
  }

  if (req.method === 'POST') {
    const { pat, org } = (req.body ?? {}) as { pat?: string; org?: string }
    const orgVal = (org ?? '').trim()
    if (!pat?.trim()) {
      res.status(400).json({ error: 'Provide a Personal Access Token.' })
      return
    }
    if (!orgVal) {
      res.status(400).json({ error: 'Provide your Azure DevOps organization.' })
      return
    }
    await kv.set(key, { org: orgVal, pat: encryptSecret(pat.trim()) } satisfies StoredTfs)
    res.status(200).json({ configured: true, org: orgVal })
    return
  }

  if (req.method === 'DELETE') {
    await kv.del(key)
    res.status(200).json({ configured: false, org: null })
    return
  }

  res.status(405).json({ error: 'Method not allowed.' })
}
