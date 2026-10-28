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

function readUserGithub(userId: string): { pat?: string; org?: string; login?: string } {
  try {
    return JSON.parse(readUserJson(userId, 'github.json', '{}'))
  } catch {
    return {}
  }
}

function resolveDevGithub(env: Record<string, string>, userId: string): { pat: string; org?: string } | null {
  const stored = readUserGithub(userId)
  if (stored.pat) return { pat: stored.pat, org: stored.org }
  if (env.OWNER_USER_ID && env.OWNER_USER_ID === userId && env.GITHUB_PAT) {
    return { pat: env.GITHUB_PAT, org: env.GITHUB_ORG || undefined }
  }
  return null
}

async function githubGraphQL<T>(pat: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json', 'User-Agent': 'relax-dashboard' },
    body: JSON.stringify({ query, variables }),
  })
  if (r.status === 401 || r.status === 403) throw new Error('Unauthorized — check the token and its scopes.')
  const body = (await r.json()) as { data?: T; errors?: { message: string }[] }
  if (body.errors?.length) throw new Error(body.errors[0].message)
  if (!body.data) throw new Error('No data returned from GitHub.')
  return body.data
}

const CAL_Q = `query($from:DateTime!,$to:DateTime!){viewer{login contributionsCollection(from:$from,to:$to){contributionCalendar{totalContributions weeks{contributionDays{date color contributionCount weekday}}}}}}`
const PR_Q = `query($q:String!,$after:String){search(query:$q,type:ISSUE,first:100,after:$after){pageInfo{hasNextPage endCursor}nodes{... on PullRequest{state isDraft merged repository{name url primaryLanguage{name color}}}}}}`

type GhLang = { name: string; color: string | null } | null
type GhPr = { state: string; isDraft: boolean; merged: boolean; repository: { name: string; url: string; primaryLanguage: GhLang } }
type GhBucket = 'open' | 'draft' | 'merged' | 'closed'

function ghBucket(pr: GhPr): GhBucket {
  if (pr.merged) return 'merged'
  if (pr.state === 'CLOSED') return 'closed'
  if (pr.isDraft) return 'draft'
  return 'open'
}

function ghRange(url: string): { from: Date; to: Date } {
  const sp = new URL(url, 'http://localhost').searchParams
  const f = sp.get('from')
  const t = sp.get('to')
  const ok = (s: string | null): s is string => Boolean(s) && /^\d{4}-\d{2}-\d{2}$/.test(s ?? '')
  if (ok(f) && ok(t)) return { from: new Date(`${f}T00:00:00Z`), to: new Date(`${t}T23:59:59Z`) }
  const to = new Date()
  const from = new Date(to)
  from.setUTCFullYear(to.getUTCFullYear() - 1)
  from.setUTCDate(from.getUTCDate() + 1)
  return { from, to }
}

type GhSearchResponse = {
  search: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: (GhPr | null)[] }
}

async function devGithubPrs(pat: string, q: string): Promise<GhPr[]> {
  const out: GhPr[] = []
  let after: string | null = null
  for (let i = 0; i < 10; i += 1) {
    const data: GhSearchResponse = await githubGraphQL<GhSearchResponse>(pat, PR_Q, { q, after })
    for (const n of data.search.nodes) if (n) out.push(n)
    if (!data.search.pageInfo.hasNextPage) break
    after = data.search.pageInfo.endCursor
  }
  return out
}

type GhRepoStat = { name: string; url: string; language: string | null; languageColor: string | null; open: number; draft: number; merged: number; closed: number; total: number }

function ghAggregate(prs: GhPr[]) {
  const totals = { open: 0, draft: 0, merged: 0, closed: 0, total: 0 }
  const repoMap = new Map<string, GhRepoStat>()
  const langMap = new Map<string, { name: string; color: string | null; count: number }>()
  for (const pr of prs) {
    const b = ghBucket(pr)
    totals[b] += 1
    totals.total += 1
    const lang = pr.repository.primaryLanguage
    const r = repoMap.get(pr.repository.name) ?? { name: pr.repository.name, url: pr.repository.url, language: lang?.name ?? null, languageColor: lang?.color ?? null, open: 0, draft: 0, merged: 0, closed: 0, total: 0 }
    r[b] += 1
    r.total += 1
    repoMap.set(pr.repository.name, r)
    const ln = lang?.name ?? 'Other'
    const l = langMap.get(ln) ?? { name: ln, color: lang?.color ?? null, count: 0 }
    l.count += 1
    langMap.set(ln, l)
  }
  const repos = [...repoMap.values()].sort((a, b) => b.total - a.total)
  const languages = [...langMap.values()].sort((a, b) => b.count - a.count)
  return { totals, repos, languages }
}

type GhCalResponse = { viewer: { login: string; contributionsCollection: { contributionCalendar: { totalContributions: number; weeks: { contributionDays: { date: string; color: string; contributionCount: number; weekday: number }[] }[] } } } }

async function devGithubContributions(pat: string, org: string | undefined, from: Date, to: Date) {
  const calData = await githubGraphQL<GhCalResponse>(pat, CAL_Q, { from: from.toISOString(), to: to.toISOString() })
  const login = calData.viewer.login
  const cal = calData.viewer.contributionsCollection.contributionCalendar
  const calendar = {
    totalContributions: cal.totalContributions,
    weeks: cal.weeks.map((w) => ({
      days: w.contributionDays.map((d) => ({ date: d.date, color: d.color, count: d.contributionCount, weekday: d.weekday })),
    })),
  }
  const ymd = (d: Date) => d.toISOString().slice(0, 10)
  const parts = [`author:${login}`, 'type:pr', `created:${ymd(from)}..${ymd(to)}`]
  if (org) parts.push(`org:${org}`)
  const prs = await devGithubPrs(pat, parts.join(' '))
  return { login, calendar, ...ghAggregate(prs) }
}

function githubSettingsApiPlugin(): Plugin {
  const attach = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use('/api/github-settings', (req, res) => {
      const send = (code: number, obj: unknown) => {
        res.statusCode = code
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(obj))
      }
      const userId = devUserId(req)
      if (!userId) return send(401, { error: 'Unauthorized' })

      if (req.method === 'GET') {
        const s = readUserGithub(userId)
        return send(200, { configured: Boolean(s.pat), org: s.org ?? null, login: s.login ?? null })
      }
      if (req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', async () => {
          try {
            const { pat, org } = JSON.parse(body) as { pat?: string; org?: string }
            const orgVal = (org ?? '').trim()
            if (!pat?.trim()) return send(400, { error: 'Provide a Personal Access Token.' })
            const data = await githubGraphQL<{ viewer: { login: string } }>(pat.trim(), `query{viewer{login}}`, {})
            writeUserJson(userId, 'github.json', JSON.stringify({ pat: pat.trim(), org: orgVal || undefined, login: data.viewer.login }))
            send(200, { configured: true, org: orgVal || null, login: data.viewer.login })
          } catch (e) {
            send(400, { error: e instanceof Error ? e.message : 'Could not verify the token with GitHub.' })
          }
        })
        return
      }
      if (req.method === 'DELETE') {
        writeUserJson(userId, 'github.json', '{}')
        return send(200, { configured: false, org: null, login: null })
      }
      send(405, { error: 'Method not allowed.' })
    })
  }
  return { name: 'github-settings-api', configureServer: attach, configurePreviewServer: attach }
}

function githubContributionsApiPlugin(env: Record<string, string>): Plugin {
  const attach = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use('/api/github-contributions', async (req, res) => {
      const send = (code: number, obj: unknown) => {
        res.statusCode = code
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(obj))
      }
      const userId = devUserId(req)
      if (!userId) return send(401, { error: 'Unauthorized' })
      const creds = resolveDevGithub(env, userId)
      if (!creds) return send(501, { error: 'Add your GitHub token to see contributions.' })
      const { from, to } = ghRange(req.url ?? '')
      try {
        send(200, await devGithubContributions(creds.pat, creds.org, from, to))
      } catch (e) {
        send(502, { error: e instanceof Error ? e.message : 'Could not reach GitHub.' })
      }
    })
  }
  return { name: 'github-contributions-api', configureServer: attach, configurePreviewServer: attach }
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
      githubSettingsApiPlugin(),
      githubContributionsApiPlugin(env),
    ],
  }
})
