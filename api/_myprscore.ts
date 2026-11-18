export type ReviewState = 'approved' | 'changes' | 'waiting'

export type MyPr = {
  id: string
  number: number
  title: string
  url: string
  repo: string
  repoUrl: string
  isDraft: boolean
  createdAt: string
  updatedAt: string
  review: ReviewState
}

export type MyPrsResult = { login: string; org: string | null; prs: MyPr[] }

export type GraphQLFn = <T>(query: string, variables: Record<string, unknown>) => Promise<T>

type PrNode = {
  id: string
  number: number
  title: string
  url: string
  isDraft: boolean
  createdAt: string
  updatedAt: string
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
  latestReviews: { nodes: ({ state: string } | null)[] } | null
  repository: { nameWithOwner: string; url: string }
}

type SearchResponse = {
  search: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: (PrNode | null)[] }
}

const VIEWER_QUERY = `query{ viewer{ login } }`

const OPEN_PRS_QUERY = `query($q:String!,$after:String){
  search(query:$q, type:ISSUE, first:100, after:$after){
    pageInfo{ hasNextPage endCursor }
    nodes{
      ... on PullRequest{
        id number title url isDraft createdAt updatedAt reviewDecision
        latestReviews(first:20){ nodes{ state } }
        repository{ nameWithOwner url }
      }
    }
  }
}`

const MAX_PAGES = 3

export function reviewState(node: Pick<PrNode, 'reviewDecision' | 'latestReviews'>): ReviewState {
  if (node.reviewDecision === 'APPROVED') return 'approved'
  if (node.reviewDecision === 'CHANGES_REQUESTED') return 'changes'
  if (node.reviewDecision === 'REVIEW_REQUIRED') return 'waiting'
  const states = (node.latestReviews?.nodes ?? []).map((n) => n?.state)
  if (states.includes('CHANGES_REQUESTED')) return 'changes'
  if (states.includes('APPROVED')) return 'approved'
  return 'waiting'
}

export function toMyPr(n: PrNode): MyPr {
  return {
    id: n.id,
    number: n.number,
    title: n.title,
    url: n.url,
    repo: n.repository.nameWithOwner,
    repoUrl: n.repository.url,
    isDraft: n.isDraft,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    review: reviewState(n),
  }
}

export function openPrsQuery(login: string, org?: string): string {
  const parts = ['is:pr', 'is:open', 'archived:false', `author:${login}`, 'sort:created-asc']
  if (org) parts.push(`org:${org}`)
  return parts.join(' ')
}

export async function fetchMyOpenPrs(gql: GraphQLFn, org?: string): Promise<MyPrsResult> {
  const { viewer } = await gql<{ viewer: { login: string } }>(VIEWER_QUERY, {})
  const q = openPrsQuery(viewer.login, org)
  const prs: MyPr[] = []
  let after: string | null = null
  for (let i = 0; i < MAX_PAGES; i += 1) {
    const data: SearchResponse = await gql<SearchResponse>(OPEN_PRS_QUERY, { q, after })
    for (const n of data.search.nodes) if (n?.id) prs.push(toMyPr(n))
    if (!data.search.pageInfo.hasNextPage) break
    after = data.search.pageInfo.endCursor
  }
  return { login: viewer.login, org: org ?? null, prs }
}
