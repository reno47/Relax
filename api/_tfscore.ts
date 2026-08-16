const WI_FIELDS =
  'System.Id,System.Title,System.IterationPath,System.WorkItemType,System.State,System.TeamProject'
const WANTED = new Set([
  'Microsoft.RequirementCategory',
  'Microsoft.FeatureCategory',
  'Microsoft.BugCategory',
])

export type AssignedItem = {
  id: number
  title: string
  iteration: string
  type: string
  state: string
  url: string
  order: number
}

export type IterationOption = { path: string; name: string; order: number }

export type AssignedResult = { items: AssignedItem[]; iterations: IterationOption[] }

type NodeInfo = { order: number; startDate?: string }

type RawNode = { path?: string; attributes?: { startDate?: string }; children?: RawNode[] }

type RawItem = { id: number; fields?: Record<string, string> }

function basic(pat: string): string {
  const token = Buffer.from(`:${pat}`).toString('base64')
  return `Basic ${token}`
}

function orgBase(org: string): string {
  return `https://dev.azure.com/${encodeURIComponent(org)}/_apis/`
}

function projectBase(org: string, project: string): string {
  return `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/`
}

async function assignedIds(org: string, pat: string, area?: string, project?: string): Promise<number[]> {
  const base = project ? projectBase(org, project) : orgBase(org)
  const areaClause = area ? ` AND [System.AreaPath] UNDER '${area.replaceAll("'", "''")}'` : ''
  const query = `SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = @Me${areaClause}`
  const r = await fetch(`${base}wit/wiql?api-version=7.0`, {
    method: 'POST',
    headers: { Authorization: basic(pat), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!r.ok) return []
  const data = (await r.json()) as { workItems?: { id: number }[] }
  return (data.workItems ?? []).map((w) => w.id)
}

async function fetchDetails(org: string, pat: string, ids: number[]): Promise<RawItem[]> {
  if (!ids.length) return []
  const list = ids.slice(0, 200).join(',')
  const r = await fetch(
    `${orgBase(org)}wit/workitems?ids=${list}&fields=${WI_FIELDS}&api-version=7.0`,
    { headers: { Authorization: basic(pat) } },
  )
  if (!r.ok) return []
  const data = (await r.json()) as { value?: RawItem[] }
  return data.value ?? []
}

async function projectTypes(org: string, project: string, pat: string): Promise<Set<string>> {
  const set = new Set<string>()
  const r = await fetch(`${projectBase(org, project)}wit/workitemtypecategories?api-version=7.0`, {
    headers: { Authorization: basic(pat) },
  })
  if (!r.ok) return set
  const data = (await r.json()) as {
    value?: { referenceName: string; workItemTypes?: { name?: string }[] }[]
  }
  for (const c of data.value ?? []) {
    if (!WANTED.has(c.referenceName)) continue
    for (const t of c.workItemTypes ?? []) if (t.name) set.add(t.name)
  }
  return set
}

function normalizePath(p?: string): string {
  if (!p) return ''
  return p.replace(/^\\/, '').replace(/\\Iteration(?=\\|$)/, '')
}

function flatten(node: RawNode, map: Map<string, NodeInfo>, counter: { n: number }): void {
  const norm = normalizePath(node.path)
  if (norm) map.set(norm, { order: counter.n++, startDate: node.attributes?.startDate })
  for (const c of node.children ?? []) flatten(c, map, counter)
}

async function mergeProjectIterations(
  org: string,
  project: string,
  pat: string,
  map: Map<string, NodeInfo>,
): Promise<void> {
  const r = await fetch(
    `${projectBase(org, project)}wit/classificationnodes/Iterations?$depth=10&api-version=7.0`,
    { headers: { Authorization: basic(pat) } },
  )
  if (!r.ok) return
  flatten((await r.json()) as RawNode, map, { n: map.size })
}

function leaf(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean)
  return parts.at(-1) ?? p
}

function compareIterations(a: NodeInfo | undefined, b: NodeInfo | undefined): number {
  if (a?.startDate && b?.startDate) return a.startDate.localeCompare(b.startDate)
  return (a?.order ?? Number.MAX_SAFE_INTEGER) - (b?.order ?? Number.MAX_SAFE_INTEGER)
}

function rankIterations(paths: string[], order: Map<string, NodeInfo>): Map<string, number> {
  const sorted = Array.from(new Set(paths))
    .filter(Boolean)
    .sort((a, b) => compareIterations(order.get(a), order.get(b)))
  return new Map(sorted.map((p, i) => [p, i]))
}

export async function fetchAssigned(org: string, pat: string, area?: string): Promise<AssignedResult> {
  const project = area ? area.split(/[\\/]/).find(Boolean) ?? '' : ''
  const ids = await assignedIds(org, pat, area, project)
  const details = await fetchDetails(org, pat, ids)
  if (!details.length) return { items: [], iterations: [] }

  const projects = Array.from(
    new Set(details.map((d) => d.fields?.['System.TeamProject'] ?? '').filter(Boolean)),
  )
  const order = new Map<string, NodeInfo>()
  const typeSets = await Promise.all(
    projects.map(async (p) => {
      await mergeProjectIterations(org, p, pat, order)
      return [p, await projectTypes(org, p, pat)] as const
    }),
  )
  const wantedByProject = new Map(typeSets)

  const kept = details.filter((d) => {
    const proj = d.fields?.['System.TeamProject'] ?? ''
    const type = d.fields?.['System.WorkItemType'] ?? ''
    return wantedByProject.get(proj)?.has(type)
  })

  const rank = rankIterations(
    kept.map((d) => d.fields?.['System.IterationPath'] ?? ''),
    order,
  )

  const items: AssignedItem[] = kept.map((d) => {
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

  const iterations: IterationOption[] = Array.from(rank.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([p, orderIdx]) => ({ path: p, name: leaf(p), order: orderIdx }))

  return { items, iterations }
}
