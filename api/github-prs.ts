import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserId } from './_auth.js'
import { resolveGithubCredentials, githubGraphQL, GithubAuthError } from './_github.js'
import { fetchMyOpenPrs } from './_myprscore.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed.' })
    return
  }
  const userId = await getUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const creds = await resolveGithubCredentials(userId)
  if (!creds) {
    res.status(501).json({ error: 'Add your GitHub token to see your pull requests.' })
    return
  }
  try {
    const result = await fetchMyOpenPrs((query, variables) => githubGraphQL(creds.pat, query, variables), creds.org)
    res.status(200).json(result)
  } catch (e) {
    if (e instanceof GithubAuthError) {
      res.status(401).json({ error: e.message })
      return
    }
    res.status(502).json({ error: 'Could not reach GitHub.' })
  }
}
