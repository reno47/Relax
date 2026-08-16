import type { VercelRequest } from '@vercel/node'
import { verifyToken } from '@clerk/backend'

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
