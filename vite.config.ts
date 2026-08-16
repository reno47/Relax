import { defineConfig, loadEnv, type Plugin, type ViteDevServer, type PreviewServer } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const USERS_DIR = path.resolve(__dirname, 'data', 'users')

function devUserId(req: { headers: Record<string, string | string[] | undefined> }): string | null {
  const header = req.headers.authorization
  const value = Array.isArray(header) ? header[0] : header
  const token = value?.startsWith('Bearer ') ? value.slice(7) : null
  if (!token) return null
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

function userFile(userId: string, name: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return path.resolve(USERS_DIR, safe, name)
}

function readUserJson(userId: string, name: string, fallback: string): string {
  try {
    return fs.readFileSync(userFile(userId, name), 'utf-8')
  } catch {
    return fallback
  }
}

function writeUserJson(userId: string, name: string, body: string): void {
  const file = userFile(userId, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body, 'utf-8')
}

function userJsonApi(route: string, fileName: string, fallback: string) {
  return (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use(route, (req, res) => {
      const send = (code: number, str: string) => {
        res.statusCode = code
        res.setHeader('Content-Type', 'application/json')
        res.end(str)
      }
      const userId = devUserId(req)
      if (!userId) return send(401, '{"error":"Unauthorized"}')

      if (req.method === 'GET') {
        return send(200, readUserJson(userId, fileName, fallback))
      }
      if (req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          try {
            JSON.parse(body)
            writeUserJson(userId, fileName, body)
            send(200, '{"ok":true}')
          } catch {
            send(400, '{"ok":false}')
          }
        })
        return
      }
      send(405, '')
    })
  }
}

function dashboardApiPlugin(): Plugin {
  const attachCalendar = userJsonApi('/api/calendar', 'calendar.json', '{"categories":null,"marks":null}')
  const attachState = userJsonApi('/api/state', 'state.json', '{}')
  const attach = (server: ViteDevServer | PreviewServer) => {
    attachCalendar(server)
    attachState(server)
  }
  return {
    name: 'dashboard-api',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

function readUserTfs(userId: string): { org?: string; pat?: string; area?: string } {
  try {
    return JSON.parse(readUserJson(userId, 'tfs.json', '{}'))
  } catch {
    return {}
  }
}

function resolveDevTfs(env: Record<string, string>, userId: string): { org: string; pat: string; area?: string } | null {
  const stored = readUserTfs(userId)
  if (stored.pat) return { pat: stored.pat, org: stored.org ?? '', area: stored.area }
  if (env.OWNER_USER_ID && env.OWNER_USER_ID === userId && env.AZDO_PAT) {
    return { pat: env.AZDO_PAT, org: env.AZDO_ORG || '' }
  }
  return null
}

function tfsApiPlugin(env: Record<string, string>): Plugin {
  const attach = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use('/api/tfs', async (req, res) => {
      const send = (code: number, obj: unknown) => {
        res.statusCode = code
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(obj))
      }
      const userId = devUserId(req)
      if (!userId) return send(401, { error: 'Unauthorized' })
      const creds = resolveDevTfs(env, userId)
      const id = (new URL(req.url ?? '', 'http://localhost').searchParams.get('id') ?? '').trim()
      if (!creds) return send(501, { error: 'Add your Azure DevOps Personal Access Token to look up work items.' })
      if (!creds.org) return send(400, { error: 'No Azure DevOps organization set — add it in TFS settings.' })
      if (!/^\d+$/.test(id)) return send(400, { error: 'Provide a numeric work item ID.' })

      const { pat, org } = creds
      const fields = 'System.Id,System.Title,System.IterationPath,System.WorkItemType,System.State'
      const api = `https://dev.azure.com/${encodeURIComponent(org)}/_apis/wit/workitems/${id}?fields=${fields}&api-version=7.0`
      const auth = Buffer.from(`:${pat}`).toString('base64')
      try {
        const r = await fetch(api, { headers: { Authorization: `Basic ${auth}` } })
        if (!r.ok) return send(r.status, { error: `Azure DevOps returned ${r.status}.` })
        const data = (await r.json()) as { id: number; fields?: Record<string, string> }
        const f = data.fields ?? {}
        return send(200, {
          id: data.id,
          title: f['System.Title'] ?? '',
          iteration: f['System.IterationPath'] ?? '',
          type: f['System.WorkItemType'] ?? '',
          state: f['System.State'] ?? '',
          url: `https://dev.azure.com/${org}/_workitems/edit/${data.id}`,
        })
      } catch {
        return send(502, { error: 'Could not reach Azure DevOps.' })
      }
    })
  }
  return { name: 'tfs-api', configureServer: attach, configurePreviewServer: attach }
}

function tfsSettingsApiPlugin(): Plugin {
  const attach = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use('/api/tfs-settings', (req, res) => {
      const send = (code: number, obj: unknown) => {
        res.statusCode = code
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(obj))
      }
      const userId = devUserId(req)
      if (!userId) return send(401, { error: 'Unauthorized' })

      if (req.method === 'GET') {
        const s = readUserTfs(userId)
        return send(200, { configured: Boolean(s.pat), org: s.org ?? null, area: s.area ?? null })
      }
      if (req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          try {
            const { pat, org, area } = JSON.parse(body) as { pat?: string; org?: string; area?: string }
            const orgVal = (org ?? '').trim()
            const areaVal = (area ?? '').trim()
            if (!pat?.trim()) return send(400, { error: 'Provide a Personal Access Token.' })
            if (!orgVal) return send(400, { error: 'Provide your Azure DevOps organization.' })
            if (!areaVal) return send(400, { error: 'Provide an area path.' })
            writeUserJson(userId, 'tfs.json', JSON.stringify({ org: orgVal, pat: pat.trim(), area: areaVal }))
            send(200, { configured: true, org: orgVal, area: areaVal })
          } catch {
            send(400, { error: 'Invalid request.' })
          }
        })
        return
      }
      if (req.method === 'DELETE') {
        writeUserJson(userId, 'tfs.json', '{}')
        return send(200, { configured: false, org: null, area: null })
      }
      send(405, { error: 'Method not allowed.' })
    })
  }
  return { name: 'tfs-settings-api', configureServer: attach, configurePreviewServer: attach }
}

type DevAssignedResult = {
  items: { id: number; title: string; iteration: string; type: string; state: string; url: string; order: number }[]
  iterations: { path: string; name: string; order: number }[]
}

async function devAssigned(org: string, pat: string, area?: string): Promise<DevAssignedResult> {
  const headers = { Authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}` }
  const orgApi = `https://dev.azure.com/${encodeURIComponent(org)}/_apis/`
  const projApi = (p: string) => `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(p)}/_apis/`
  const wanted = ['Microsoft.RequirementCategory', 'Microsoft.FeatureCategory', 'Microsoft.BugCategory']

  const areaClause = area ? ` AND [System.AreaPath] UNDER '${area.replace(/'/g, "''")}'` : ''
  const project = area ? area.split(/[\\/]/).filter(Boolean)[0] ?? '' : ''
  const wiqlBase = project ? projApi(project) : orgApi
  const wiql = await fetch(`${wiqlBase}wit/wiql?api-version=7.0`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = @Me${areaClause}` }),
  })
  const ids = wiql.ok
    ? (((await wiql.json()) as { workItems?: { id: number }[] }).workItems ?? []).map((w) => w.id)
    : []
  if (!ids.length) return { items: [], iterations: [] }

  const fields = 'System.Id,System.Title,System.IterationPath,System.WorkItemType,System.State,System.TeamProject'
  const det = await fetch(`${orgApi}wit/workitems?ids=${ids.slice(0, 200).join(',')}&fields=${fields}&api-version=7.0`, { headers })
  const raw = det.ok
    ? ((await det.json()) as { value?: { id: number; fields?: Record<string, string> }[] }).value ?? []
    : []
  const projects = Array.from(new Set(raw.map((d) => d.fields?.['System.TeamProject'] ?? '').filter(Boolean)))

  const typeSet = new Set<string>()
  for (const p of projects) {
    const cr = await fetch(`${projApi(p)}wit/workitemtypecategories?api-version=7.0`, { headers })
    if (!cr.ok) continue
    const cd = (await cr.json()) as { value?: { referenceName: string; workItemTypes?: { name?: string }[] }[] }
    for (const c of cd.value ?? []) {
      if (!wanted.includes(c.referenceName)) continue
      for (const t of c.workItemTypes ?? []) if (t.name) typeSet.add(t.name)
    }
  }

  const kept = raw.filter((d) => typeSet.has(d.fields?.['System.WorkItemType'] ?? ''))
  const paths = Array.from(new Set(kept.map((d) => d.fields?.['System.IterationPath'] ?? ''))).filter(Boolean).sort()
  const rank = new Map(paths.map((p, i) => [p, i] as const))
  const items = kept.map((d) => {
    const f = d.fields ?? {}
    const iteration = f['System.IterationPath'] ?? ''
    return {
      id: d.id,
      title: f['System.Title'] ?? '',
      iteration,
      type: f['System.WorkItemType'] ?? '',
      state: f['System.State'] ?? '',
      url: `https://dev.azure.com/${org}/_workitems/edit/${d.id}`,
      order: rank.get(iteration) ?? 0,
    }
  })
  const iterations = paths.map((p, i) => ({ path: p, name: p.split(/[\\/]/).filter(Boolean).pop() ?? p, order: i }))
  return { items, iterations }
}

function tfsAssignedApiPlugin(env: Record<string, string>): Plugin {
  const attach = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use('/api/tfs-assigned', async (req, res) => {
      const send = (code: number, obj: unknown) => {
        res.statusCode = code
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(obj))
      }
      const userId = devUserId(req)
      if (!userId) return send(401, { error: 'Unauthorized' })
      const creds = resolveDevTfs(env, userId)
      if (!creds) return send(501, { error: 'Add your Azure DevOps Personal Access Token to see assigned work items.' })
      if (!creds.org) return send(400, { error: 'No Azure DevOps organization set — add it in TFS settings.' })
      try {
        send(200, await devAssigned(creds.org, creds.pat, creds.area))
      } catch {
        send(502, { error: 'Could not reach Azure DevOps.' })
      }
    })
  }
  return { name: 'tfs-assigned-api', configureServer: attach, configurePreviewServer: attach }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      dashboardApiPlugin(),
      tfsApiPlugin(env),
      tfsSettingsApiPlugin(),
      tfsAssignedApiPlugin(env),
    ],
  }
})
