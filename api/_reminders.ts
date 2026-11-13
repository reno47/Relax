import crypto from 'node:crypto'
import type { VercelRequest } from '@vercel/node'
import { withPrefix, type Kv } from './_kv.js'
import { decryptSecret } from './_crypto.js'
import {
  DAY_MS,
  afterFire,
  buildReminderCard,
  isFireable,
  needsSchedule,
  pruneCompleted,
  type Reminder,
} from './_remindercore.js'

// QStash caps delays at 7 days; anything later is picked up by the daily cron.
export const MAX_DELAY_MS = 7 * DAY_MS - 2 * 3_600_000

export type StoredTeams = { url: string }

export const remindersKey = (userId: string) => withPrefix(`user:${userId}:reminders`)
export const teamsKey = (userId: string) => withPrefix(`user:${userId}:teams`)
const usersSetKey = () => withPrefix('reminders:users')

export async function loadReminders(kv: Kv, userId: string): Promise<Reminder[]> {
  const list = (await kv.get<Reminder[]>(remindersKey(userId))) ?? []
  return pruneCompleted(list, Date.now())
}

export async function saveReminders(kv: Kv, userId: string, list: Reminder[]): Promise<void> {
  await kv.set(remindersKey(userId), list)
  if (list.length) await kv.sadd(usersSetKey(), userId)
  else await kv.srem(usersSetKey(), userId)
}

export async function reminderUsers(kv: Kv): Promise<string[]> {
  return kv.smembers(usersSetKey())
}

export function baseUrlFrom(req: VercelRequest): string {
  if (process.env.REMINDER_BASE_URL) return process.env.REMINDER_BASE_URL.replace(/\/$/, '')
  return `https://${req.headers.host}`
}

export function cronBaseUrl(): string {
  const url = process.env.REMINDER_BASE_URL || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  return url.replace(/\/$/, '')
}

function qstashBase(): string {
  return (process.env.QSTASH_URL || 'https://qstash.upstash.io').replace(/\/$/, '')
}

async function publishFire(baseUrl: string, userId: string, r: Reminder): Promise<string | undefined> {
  const token = process.env.QSTASH_TOKEN
  if (!token || r.due - Date.now() > MAX_DELAY_MS) return undefined
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Upstash-Not-Before': String(Math.floor(r.due / 1000)),
    'Upstash-Retries': '3',
  }
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  if (bypass) headers['Upstash-Forward-x-vercel-protection-bypass'] = bypass
  try {
    const res = await fetch(`${qstashBase()}/v2/publish/${baseUrl}/api/reminder-fire`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ u: userId, r: r.id, at: r.due }),
    })
    if (!res.ok) return undefined
    return ((await res.json()) as { messageId?: string }).messageId
  } catch {
    return undefined
  }
}

async function cancelMessage(msgId: string | undefined): Promise<void> {
  const token = process.env.QSTASH_TOKEN
  if (!msgId || !token) return
  try {
    await fetch(`${qstashBase()}/v2/messages/${encodeURIComponent(msgId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    // A stale message is harmless: reminder-fire ignores it.
  }
}

/** Cancels the previous delivery and books a new one when the reminder is still pending. */
export async function reschedule(baseUrl: string, userId: string, r: Reminder, prevMsgId?: string) {
  await cancelMessage(prevMsgId)
  r.msgId = needsSchedule(r, Date.now()) ? await publishFire(baseUrl, userId, r) : undefined
}

export async function unschedule(r: Reminder | undefined): Promise<void> {
  await cancelMessage(r?.msgId)
}

export async function teamsUrl(kv: Kv, userId: string): Promise<string | null> {
  const stored = await kv.get<StoredTeams>(teamsKey(userId))
  return stored?.url ? decryptSecret(stored.url) : null
}

export async function postToTeams(url: string, payload: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch {
    return false
  }
}

export type FireOutcome = 'sent' | 'skipped' | 'failed'

export async function fireReminder(kv: Kv, userId: string, id: string, at: number, baseUrl: string) {
  const list = await loadReminders(kv, userId)
  const current = list.find((r) => r.id === id)
  if (!isFireable(current, at)) return 'skipped' satisfies FireOutcome
  const url = await teamsUrl(kv, userId)
  if (url && !(await postToTeams(url, buildReminderCard(current)))) {
    return 'failed' satisfies FireOutcome
  }
  const next = afterFire(current, Date.now())
  await reschedule(baseUrl, userId, next)
  await saveReminders(kv, userId, list.map((r) => (r.id === id ? next : r)))
  return 'sent' satisfies FireOutcome
}

function verifyWithKey(token: string, key: string, body: string): boolean {
  const [header, payload, signature] = token.split('.')
  if (!header || !payload || !signature) return false
  const expected = crypto.createHmac('sha256', key).update(`${header}.${payload}`).digest('base64url')
  const a = Uint8Array.from(Buffer.from(signature))
  const b = Uint8Array.from(Buffer.from(expected))
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    const now = Math.floor(Date.now() / 1000)
    if (claims.iss !== 'Upstash') return false
    if (typeof claims.exp === 'number' && now > claims.exp) return false
    if (typeof claims.nbf === 'number' && now + 60 < claims.nbf) return false
    const hash = crypto.createHash('sha256').update(body).digest('base64url')
    return String(claims.body ?? '').replace(/=+$/, '') === hash
  } catch {
    return false
  }
}

export function verifyQstashSignature(token: string | undefined, body: string): boolean {
  if (!token) return false
  const keys = [process.env.QSTASH_CURRENT_SIGNING_KEY, process.env.QSTASH_NEXT_SIGNING_KEY]
  return keys.some((k) => Boolean(k) && verifyWithKey(token, k as string, body))
}
