import { defineConfig, loadEnv, type Plugin, type ViteDevServer, type PreviewServer } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const USERS_DIR = path.resolve(__dirname, 'data', 'users')

// Dev-only: decode the Clerk token's `sub` (no signature check — this is the
// local dev server, not a security boundary). Real verification happens in the
// serverless `/api` functions on Vercel.
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

// Dev-only owner migration: seed the owner's per-user file from the old global
// file once (mirrors the serverless Phase 3 migration). Matches OWNER_USER_ID.
function devMigrateOwner(env: Record<string, string>, userId: string, fileName: string): void {
  if (!env.OWNER_USER_ID || env.OWNER_USER_ID !== userId) return
  const userPath = userFile(userId, fileName)
  try {
    const cur = JSON.parse(fs.readFileSync(userPath, 'utf-8'))
    if (cur && Object.keys(cur).length > 0) return // already has data
  } catch {
    /* no user file yet — continue */
  }
  try {
    const g = fs.readFileSync(path.resolve(__dirname, 'data', fileName), 'utf-8')
    fs.mkdirSync(path.dirname(userPath), { recursive: true })
    fs.writeFileSync(userPath, g, 'utf-8')
  } catch {
    /* no global backup to migrate */
  }
}

// Per-user JSON file API (auth-gated) used by the calendar and dashboard state.
function userJsonApi(env: Record<string, string>, route: string, fileName: string, fallback: string) {
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
        devMigrateOwner(env, userId, fileName)
        return send(200, readUserJson(userId, fileName, fallback))
      }
      if (req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          try {
            JSON.parse(body) // validate
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

// Persists per-user calendar + dashboard state to JSON files on disk so local
// dev mirrors the per-user isolation of the serverless functions.
function dashboardApiPlugin(env: Record<string, string>): Plugin {
  const attachCalendar = userJsonApi(env, '/api/calendar', 'calendar.json', '{"categories":null,"marks":null}')
  const attachState = userJsonApi(env, '/api/state', 'state.json', '{}')
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

// Dev-time Azure DevOps work-item lookup, mirroring the /api/tfs serverless
// function so it also works with `npm run dev` / `vite preview`. Uses the
// per-user PAT saved via /api/tfs-settings; the owner may fall back to env.
function readUserTfs(userId: string): { org?: string; pat?: string } {
  try {
    return JSON.parse(readUserJson(userId, 'tfs.json', '{}'))
  } catch {
    return {}
  }
}

function resolveDevTfs(env: Record<string, string>, userId: string): { org: string; pat: string } | null {
  const stored = readUserTfs(userId)
  if (stored.pat) return { pat: stored.pat, org: stored.org ?? '' }
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

// Dev-time per-user TFS connection settings, mirroring /api/tfs-settings.
// Stored as plaintext in the gitignored data/users dir (dev is not a security
// boundary; production encrypts the PAT at rest).
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
        return send(200, { configured: Boolean(s.pat), org: s.org ?? null })
      }
      if (req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          try {
            const { pat, org } = JSON.parse(body) as { pat?: string; org?: string }
            const orgVal = (org ?? '').trim()
            if (!pat?.trim()) return send(400, { error: 'Provide a Personal Access Token.' })
            if (!orgVal) return send(400, { error: 'Provide your Azure DevOps organization.' })
            writeUserJson(userId, 'tfs.json', JSON.stringify({ org: orgVal, pat: pat.trim() }))
            send(200, { configured: true, org: orgVal })
          } catch {
            send(400, { error: 'Invalid request.' })
          }
        })
        return
      }
      if (req.method === 'DELETE') {
        writeUserJson(userId, 'tfs.json', '{}')
        return send(200, { configured: false, org: null })
      }
      send(405, { error: 'Method not allowed.' })
    })
  }
  return { name: 'tfs-settings-api', configureServer: attach, configurePreviewServer: attach }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), dashboardApiPlugin(env), tfsApiPlugin(env), tfsSettingsApiPlugin()],
  }
})
