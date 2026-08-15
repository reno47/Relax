import type { VercelRequest } from '@vercel/node'
import { verifyToken } from '@clerk/backend'

// Verifies the Clerk session token from the Authorization header and returns
// the user id (`sub`). Returns null if missing/invalid. Files prefixed with
// `_` are not treated as routes by Vercel.
export async function getUserId(req: VercelRequest): Promise<string | null> {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) return null

  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null

  try {
    const claims = await verifyToken(token, { secretKey })
    return claims.sub ?? null
  } catch {
    return null
  }
}
