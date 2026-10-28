import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserId } from './_auth.js'
import { resolveGithubCredentials, GithubAuthError } from './_github.js'
import { fetchContributions } from './_githubcore.js'

function parseDate(value: unknown): Date | null {
  const s = (typeof value === 'string' ? value : '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(`${s}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

function defaultRange(): { from: Date; to: Date } {
  const to = new Date()
  const from = new Date(to)
  from.setUTCFullYear(to.getUTCFullYear() - 1)
  from.setUTCDate(from.getUTCDate() + 1)
  return { from, to }
}

function resolveRange(req: VercelRequest): { from: Date; to: Date } {
  const from = parseDate(req.query.from)
  const to = parseDate(req.query.to)
  if (from && to && from <= to) return { from, to: new Date(`${req.query.to}T23:59:59Z`) }
  return defaultRange()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const creds = await resolveGithubCredentials(userId)
  if (!creds) {
    res.status(501).json({ error: 'Add your GitHub token to see contributions.' })
    return
  }
  const { from, to } = resolveRange(req)
  try {
    res.status(200).json(await fetchContributions(creds, from, to))
  } catch (e) {
    if (e instanceof GithubAuthError) {
      res.status(401).json({ error: e.message })
      return
    }
    res.status(502).json({ error: 'Could not reach GitHub.' })
  }
}
