import { getKv, withPrefix } from './_kv.js'
import { decryptSecret } from './_crypto.js'

export type StoredGithub = { pat: string; org?: string; login?: string }

export type GithubCreds = { pat: string; org?: string }

export class GithubAuthError extends Error {}

function credsFromEnv(userId: string): GithubCreds | null {
  const owner = process.env.OWNER_USER_ID
  if (owner && userId === owner && process.env.GITHUB_PAT) {
    return { pat: process.env.GITHUB_PAT, org: process.env.GITHUB_ORG || undefined }
  }
  return null
}

export async function resolveGithubCredentials(userId: string): Promise<GithubCreds | null> {
  const kv = await getKv()
  if (kv) {
    const stored = await kv.get<StoredGithub>(withPrefix(`user:${userId}:github`))
    if (stored?.pat) {
      try {
        return { pat: decryptSecret(stored.pat), org: stored.org }
      } catch {
        return credsFromEnv(userId)
      }
    }
  }
  return credsFromEnv(userId)
}

type GraphQLResponse<T> = { data?: T; errors?: { message: string }[] }

export async function githubGraphQL<T>(
  pat: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
      'User-Agent': 'relax-dashboard',
    },
    body: JSON.stringify({ query, variables }),
  })
  if (r.status === 401 || r.status === 403) {
    throw new GithubAuthError('Unauthorized — check the token and its scopes.')
  }
  const body = (await r.json()) as GraphQLResponse<T>
  if (body.errors?.length) throw new Error(body.errors[0].message)
  if (!body.data) throw new Error('No data returned from GitHub.')
  return body.data
}
