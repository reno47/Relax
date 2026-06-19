import { defineConfig, type Plugin, type ViteDevServer, type PreviewServer } from 'vite'
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

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), dashboardApiPlugin()],
})
