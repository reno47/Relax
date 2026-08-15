import type { VercelRequest, VercelResponse } from '@vercel/node'

// Looks up an Azure DevOps (dev.azure.com) work item by ID and returns its
// id, title and iteration. The PAT is read from an env var and never exposed
// to the browser. Configure AZDO_PAT (and optionally AZDO_ORG) in Vercel.
const ORG = process.env.AZDO_ORG || 'ALMP-ORG-EP11'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pat = process.env.AZDO_PAT
  const id = String(req.query.id ?? '').trim()

  if (!pat) {
    res.status(501).json({ error: 'Lookup not configured — AZDO_PAT is not set.' })
    return
  }
  if (!/^\d+$/.test(id)) {
    res.status(400).json({ error: 'Provide a numeric work item ID.' })
    return
  }

  const fields = 'System.Id,System.Title,System.IterationPath,System.WorkItemType,System.State'
  const url = `https://dev.azure.com/${encodeURIComponent(ORG)}/_apis/wit/workitems/${id}?fields=${fields}&api-version=7.0`
  const auth = Buffer.from(`:${pat}`).toString('base64')

  try {
    const r = await fetch(url, { headers: { Authorization: `Basic ${auth}` } })
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
      url: `https://dev.azure.com/${ORG}/_workitems/edit/${data.id}`,
    })
  } catch {
    res.status(502).json({ error: 'Could not reach Azure DevOps.' })
  }
}
