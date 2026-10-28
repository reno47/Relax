import { githubGraphQL } from './_github.js'

export type CalendarDay = { date: string; color: string; count: number; weekday: number }
export type Calendar = { totalContributions: number; weeks: { days: CalendarDay[] }[] }
export type Totals = { open: number; draft: number; merged: number; closed: number; total: number }
export type RepoStat = {
  name: string
  url: string
  language: string | null
  languageColor: string | null
  open: number
  draft: number
  merged: number
  closed: number
  total: number
}
export type LanguageStat = { name: string; color: string | null; count: number }
export type ContributionsResult = {
  login: string
  calendar: Calendar
  totals: Totals
  repos: RepoStat[]
  languages: LanguageStat[]
}

type PrBucket = 'open' | 'draft' | 'merged' | 'closed'
type PrNode = {
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  isDraft: boolean
  merged: boolean
  repository: {
    name: string
    url: string
    primaryLanguage: { name: string; color: string | null } | null
  }
}

const CALENDAR_QUERY = `query($from:DateTime!,$to:DateTime!){
  viewer{
    login
    contributionsCollection(from:$from,to:$to){
      contributionCalendar{
        totalContributions
        weeks{ contributionDays{ date color contributionCount weekday } }
      }
    }
  }
}`

const PR_QUERY = `query($q:String!,$after:String){
  search(query:$q, type:ISSUE, first:100, after:$after){
    pageInfo{ hasNextPage endCursor }
    nodes{
      ... on PullRequest{
        state
        isDraft
        merged
        repository{ name url primaryLanguage{ name color } }
      }
    }
  }
}`

type CalendarResponse = {
  viewer: {
    login: string
    contributionsCollection: {
      contributionCalendar: {
        totalContributions: number
        weeks: {
          contributionDays: { date: string; color: string; contributionCount: number; weekday: number }[]
        }[]
      }
    }
  }
}

type SearchResponse = {
  search: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: (PrNode | null)[] }
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function buildPrQuery(login: string, org: string | undefined, from: Date, to: Date): string {
  const parts = [`author:${login}`, 'type:pr', `created:${ymd(from)}..${ymd(to)}`]
  if (org) parts.push(`org:${org}`)
  return parts.join(' ')
}

async function fetchCalendar(pat: string, from: Date, to: Date): Promise<{ login: string; calendar: Calendar }> {
  const data = await githubGraphQL<CalendarResponse>(pat, CALENDAR_QUERY, {
    from: from.toISOString(),
    to: to.toISOString(),
  })
  const cal = data.viewer.contributionsCollection.contributionCalendar
  const weeks = cal.weeks.map((w) => ({
    days: w.contributionDays.map((d) => ({
      date: d.date,
      color: d.color,
      count: d.contributionCount,
      weekday: d.weekday,
    })),
  }))
  return { login: data.viewer.login, calendar: { totalContributions: cal.totalContributions, weeks } }
}

async function fetchPullRequests(pat: string, q: string): Promise<PrNode[]> {
  const out: PrNode[] = []
  let after: string | null = null
  for (let page = 0; page < 10; page += 1) {
    const data: SearchResponse = await githubGraphQL<SearchResponse>(pat, PR_QUERY, { q, after })
    for (const node of data.search.nodes) if (node) out.push(node)
    if (!data.search.pageInfo.hasNextPage) break
    after = data.search.pageInfo.endCursor
  }
  return out
}

function bucketOf(pr: PrNode): PrBucket {
  if (pr.merged) return 'merged'
  if (pr.state === 'CLOSED') return 'closed'
  if (pr.isDraft) return 'draft'
  return 'open'
}

function addRepo(map: Map<string, RepoStat>, pr: PrNode, bucket: PrBucket): void {
  const existing = map.get(pr.repository.name) ?? {
    name: pr.repository.name,
    url: pr.repository.url,
    language: pr.repository.primaryLanguage?.name ?? null,
    languageColor: pr.repository.primaryLanguage?.color ?? null,
    open: 0,
    draft: 0,
    merged: 0,
    closed: 0,
    total: 0,
  }
  existing[bucket] += 1
  existing.total += 1
  map.set(pr.repository.name, existing)
}

function addLanguage(map: Map<string, LanguageStat>, pr: PrNode): void {
  const name = pr.repository.primaryLanguage?.name ?? 'Other'
  const color = pr.repository.primaryLanguage?.color ?? null
  const existing = map.get(name) ?? { name, color, count: 0 }
  existing.count += 1
  map.set(name, existing)
}

function aggregate(prs: PrNode[]): { totals: Totals; repos: RepoStat[]; languages: LanguageStat[] } {
  const totals: Totals = { open: 0, draft: 0, merged: 0, closed: 0, total: 0 }
  const repoMap = new Map<string, RepoStat>()
  const langMap = new Map<string, LanguageStat>()
  for (const pr of prs) {
    const bucket = bucketOf(pr)
    totals[bucket] += 1
    totals.total += 1
    addRepo(repoMap, pr, bucket)
    addLanguage(langMap, pr)
  }
  const repos = [...repoMap.values()].sort((a, b) => b.total - a.total)
  const languages = [...langMap.values()].sort((a, b) => b.count - a.count)
  return { totals, repos, languages }
}

export async function fetchContributions(
  creds: { pat: string; org?: string },
  from: Date,
  to: Date,
): Promise<ContributionsResult> {
  const { login, calendar } = await fetchCalendar(creds.pat, from, to)
  const prs = await fetchPullRequests(creds.pat, buildPrQuery(login, creds.org, from, to))
  const { totals, repos, languages } = aggregate(prs)
  return { login, calendar, totals, repos, languages }
}
