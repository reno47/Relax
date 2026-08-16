import { getKv, withPrefix } from './_kv.js'
import { decryptSecret } from './_crypto.js'

type StoredTfs = { org: string; pat: string; area?: string }

export type TfsCreds = { pat: string; org: string; area?: string }

export const WI_FIELDS =
  'System.Id,System.Title,System.IterationPath,System.WorkItemType,System.State'

export function basicAuth(pat: string): string {
  const token = Buffer.from(`:${pat}`).toString('base64')
  return `Basic ${token}`
}

function credsFromEnv(userId: string): TfsCreds | null {
  const owner = process.env.OWNER_USER_ID
  if (owner && userId === owner && process.env.AZDO_PAT) {
    return { pat: process.env.AZDO_PAT, org: process.env.AZDO_ORG || '' }
  }
  return null
}

export async function resolveTfsCredentials(userId: string): Promise<TfsCreds | null> {
  const kv = await getKv()
  if (kv) {
    const stored = await kv.get<StoredTfs>(withPrefix(`user:${userId}:tfs`))
    if (stored?.pat) {
      try {
        return { pat: decryptSecret(stored.pat), org: stored.org, area: stored.area }
      } catch {
        return credsFromEnv(userId)
      }
    }
  }
  return credsFromEnv(userId)
}
