import { defineConfig, type Plugin, type ViteDevServer, type PreviewServer } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.resolve(__dirname, 'data', 'calendar.json')

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

// Persists the calendar to a JSON file on disk so the data survives
// across browsers, profiles, incognito, cleared site data and port changes.
function calendarApiPlugin(): Plugin {
  const attach = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use('/api/calendar', (req, res) => {
      if (req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json')
        res.end(readData())
        return
      }
      if (req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          try {
            JSON.parse(body) // validate
            writeData(body)
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
  return {
    name: 'calendar-api',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), calendarApiPlugin()],
})
