import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserId } from './_auth.js'
import { getKv, withPrefix } from './_kv.js'
import { encryptSecret } from './_crypto.js'
import { githubGraphQL, GithubAuthError, type StoredGithub } from './_github.js'

const VIEWER_QUERY = `query{ viewer{ login } }`

async function handleGet(kv: Awaited<ReturnType<typeof getKv>>, key: string, res: VercelResponse) {
  const stored = await kv!.get<StoredGithub>(key)
  res.status(200).json({
    configured: Boolean(stored?.pat),
    org: stored?.org ?? null,
    login: stored?.login ?? null,
  })
}

async function handlePost(
  kv: Awaited<ReturnType<typeof getKv>>,
  key: string,
  req: VercelRequest,
  res: VercelResponse,
) {
  const { pat, org } = (req.body ?? {}) as { pat?: string; org?: string }
  const orgVal = (org ?? '').trim()
  if (!pat?.trim()) {
    res.status(400).json({ error: 'Provide a Personal Access Token.' })
    return
  }
  let login: string
  try {
    const data = await githubGraphQL<{ viewer: { login: string } }>(pat.trim(), VIEWER_QUERY, {})
    login = data.viewer.login
  } catch (e) {
    const msg = e instanceof GithubAuthError ? e.message : 'Could not verify the token with GitHub.'
    res.status(400).json({ error: msg })
    return
  }
  await kv!.set(key, {
    pat: encryptSecret(pat.trim()),
    org: orgVal || undefined,
    login,
  } satisfies StoredGithub)
  res.status(200).json({ configured: true, org: orgVal || null, login })
}

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
  const key = withPrefix(`user:${userId}:github`)

  if (req.method === 'GET') return handleGet(kv, key, res)
  if (req.method === 'POST') return handlePost(kv, key, req, res)
  if (req.method === 'DELETE') {
    await kv.del(key)
    res.status(200).json({ configured: false, org: null, login: null })
    return
  }
  res.status(405).json({ error: 'Method not allowed.' })
}
