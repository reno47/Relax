import { defineConfig, loadEnv, type Plugin, type ViteDevServer, type PreviewServer } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.resolve(__dirname, 'data', 'calendar.json')
const STATE_FILE = path.resolve(__dirname, 'data', 'state.json')

function readData(): string {
  try {
    return fs.readFileSync(DATA_FILE, 'utf-8')
  } catch {
    return JSON.stringify({ categories: null, marks: null })
  }
}

function writeData(body: string): void {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  fs.writeFileSync(DATA_FILE, body, 'utf-8')
}

function readState(): string {
  try {
    return fs.readFileSync(STATE_FILE, 'utf-8')
  } catch {
    return '{}'
  }
}

function writeState(body: string): void {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
  fs.writeFileSync(STATE_FILE, body, 'utf-8')
}

// Generic JSON file API used by both the calendar and the dashboard state.
function jsonFileApi(
  route: string,
  read: () => string,
  write: (body: string) => void,
) {
  return (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use(route, (req, res) => {
      if (req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json')
        res.end(read())
        return
      }
      if (req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          try {
            JSON.parse(body) // validate
            write(body)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end('{"ok":true}')
          } catch {
            res.statusCode = 400
            res.end('{"ok":false}')
          }
        })
        return
      }
      res.statusCode = 405
      res.end()
    })
  }
}

// Persists the calendar and dashboard state to JSON files on disk so the data
// survives across browsers, profiles, incognito, cleared site data and port
// changes during local development.
function dashboardApiPlugin(): Plugin {
  const attachCalendar = jsonFileApi('/api/calendar', readData, writeData)
  const attachState = jsonFileApi('/api/state', readState, writeState)
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
// function so it also works with `npm run dev` / `vite preview`.
function tfsApiPlugin(env: Record<string, string>): Plugin {
  const org = env.AZDO_ORG || 'ALMP-ORG-EP11'
  const pat = env.AZDO_PAT
  const attach = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use('/api/tfs', async (req, res) => {
      const send = (code: number, obj: unknown) => {
        res.statusCode = code
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(obj))
      }
      const id = (new URL(req.url ?? '', 'http://localhost').searchParams.get('id') ?? '').trim()
      if (!pat) return send(501, { error: 'Lookup not configured — add AZDO_PAT to .env.' })
      if (!/^\d+$/.test(id)) return send(400, { error: 'Provide a numeric work item ID.' })

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

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), dashboardApiPlugin(), tfsApiPlugin(env)],
  }
})
