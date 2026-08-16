import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserId } from './_auth.js'
import { resolveTfsCredentials } from './_tfs.js'
import { fetchAssigned } from './_tfscore.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const creds = await resolveTfsCredentials(userId)
  if (!creds) {
    res.status(501).json({ error: 'Add your Azure DevOps Personal Access Token to see assigned work items.' })
    return
  }
  if (!creds.org) {
    res.status(400).json({ error: 'No Azure DevOps organization set — add it in TFS settings.' })
    return
  }
  try {
    res.status(200).json(await fetchAssigned(creds.org, creds.pat, creds.area))
  } catch {
    res.status(502).json({ error: 'Could not reach Azure DevOps.' })
  }
}
