import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserId } from './_auth'
import { getKv, withPrefix } from './_kv'
import { decryptSecret } from './_crypto'

// Looks up an Azure DevOps (dev.azure.com) work item by ID and returns its
// id, title and iteration. The PAT is per-user (encrypted at rest via
// /api/tfs-settings) and never exposed to the browser. As a migration aid the
// owner may keep using AZDO_PAT/AZDO_ORG from the environment.
type StoredTfs = { org: string; pat: string }

async function resolveCredentials(
  userId: string,
): Promise<{ pat: string; org: string } | null> {
  const kv = await getKv()
  if (kv) {
    const stored = await kv.get<StoredTfs>(withPrefix(`user:${userId}:tfs`))
    if (stored?.pat) {
      try {
        return { pat: decryptSecret(stored.pat), org: stored.org }
      } catch {
        /* key rotated or corrupt — fall through */
      }
    }
  }
  // Owner-only fallback to the shared env token (never used by other users).
  const owner = process.env.OWNER_USER_ID
  if (owner && userId === owner && process.env.AZDO_PAT) {
    return { pat: process.env.AZDO_PAT, org: process.env.AZDO_ORG || '' }
  }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const creds = await resolveCredentials(userId)
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
  const fields = 'System.Id,System.Title,System.IterationPath,System.WorkItemType,System.State'
  const url = `https://dev.azure.com/${encodeURIComponent(org)}/_apis/wit/workitems/${id}?fields=${fields}&api-version=7.0`
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
      url: `https://dev.azure.com/${org}/_workitems/edit/${data.id}`,
    })
  } catch {
    res.status(502).json({ error: 'Could not reach Azure DevOps.' })
  }
}
