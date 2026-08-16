import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserId } from './_auth.js'
import { resolveTfsCredentials, basicAuth, WI_FIELDS } from './_tfs.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const creds = await resolveTfsCredentials(userId)
  const id = String(req.query.id ?? '').trim()

  if (!creds) {
    res.status(501).json({ error: 'Add your Azure DevOps Personal Access Token to look up work items.' })
    return
  }
  if (!creds.org) {
    res.status(400).json({ error: 'No Azure DevOps organization set — add it in TFS settings.' })
    return
  }
  if (!/^\d+$/.test(id)) {
    res.status(400).json({ error: 'Provide a numeric work item ID.' })
    return
  }

  const { pat, org } = creds
  const url = `https://dev.azure.com/${encodeURIComponent(org)}/_apis/wit/workitems/${id}?fields=${WI_FIELDS}&api-version=7.0`

  try {
    const r = await fetch(url, { headers: { Authorization: basicAuth(pat) } })
    if (r.status === 401 || r.status === 403) {
      res.status(r.status).json({ error: 'Unauthorized — check the PAT and its scope.' })
      return
    }
    if (r.status === 404) {
      res.status(404).json({ error: `Work item ${id} not found.` })
      return
    }
    if (!r.ok) {
      res.status(502).json({ error: `Azure DevOps returned ${r.status}.` })
      return
    }
    const data = (await r.json()) as { id: number; fields?: Record<string, string> }
    const f = data.fields ?? {}
    res.status(200).json({
      id: data.id,
      title: f['System.Title'] ?? '',
      iteration: f['System.IterationPath'] ?? '',
      type: f['System.WorkItemType'] ?? '',
      state: f['System.State'] ?? '',
      url: `https://dev.azure.com/${org}/_workitems/edit/${data.id}`,
    })
  } catch {
    res.status(502).json({ error: 'Could not reach Azure DevOps.' })
  }
}
