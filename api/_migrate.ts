import type { Kv } from './_kv.js'
import { withPrefix } from './_kv.js'

// Is this user the owner? Matches OWNER_USER_ID directly, or OWNER_EMAIL by
// looking up the user's emails via Clerk.
async function isOwner(userId: string): Promise<boolean> {
  if (process.env.OWNER_USER_ID && userId === process.env.OWNER_USER_ID) return true

  const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase()
  const secretKey = process.env.CLERK_SECRET_KEY
  if (ownerEmail && secretKey) {
    try {
      const { createClerkClient } = await import('@clerk/backend')
      const clerk = createClerkClient({ secretKey })
      const user = await clerk.users.getUser(userId)
      const emails = (user.emailAddresses ?? []).map((e) => e.emailAddress.toLowerCase())
      if (emails.includes(ownerEmail)) return true
    } catch {
      /* ignore lookup failures */
    }
  }
  return false
}

// One-time copy of the pre-multitenant global blob into the owner's namespace.
// Idempotent: skips if the owner already has data. Global keys are kept as a
// backup and removed later (Phase 3b cleanup).
export async function migrateOwnerIfNeeded(kv: Kv, userId: string): Promise<void> {
  if (!(await isOwner(userId))) return

  const stateKey = withPrefix(`user:${userId}:state`)
  const existing = (await kv.get(stateKey)) as Record<string, unknown> | null
  if (existing && Object.keys(existing).length > 0) return // already has data

  const globalState = await kv.get(withPrefix('dashboard:state'))
  if (globalState) await kv.set(stateKey, globalState)

  const calKey = withPrefix(`user:${userId}:calendar`)
  const existingCal = await kv.get(calKey)
  if (!existingCal) {
    const globalCal = await kv.get(withPrefix('calendar:data'))
    if (globalCal) await kv.set(calKey, globalCal)
  }
}
