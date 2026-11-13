import crypto from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserId } from './_auth.js'
import { getKv, type Kv } from './_kv.js'
import {
  baseUrlFrom,
  loadReminders,
  reschedule,
  saveReminders,
  teamsKey,
  unschedule,
} from './_reminders.js'
import {
  applyAction,
  createReminder,
  parseReminderInput,
  publicReminder,
  type Reminder,
} from './_remindercore.js'

type Ctx = { kv: Kv; userId: string; req: VercelRequest; res: VercelResponse }

async function respond({ kv, userId, res }: Ctx, list: Reminder[]) {
  const teamsConfigured = Boolean(await kv.get(teamsKey(userId)))
  res.status(200).json({ reminders: list.map(publicReminder), teamsConfigured })
}

async function handleCreate(ctx: Ctx) {
  const now = Date.now()
  const input = parseReminderInput(ctx.req.body, now)
  if (typeof input === 'string') return ctx.res.status(400).json({ error: input })
  const list = await loadReminders(ctx.kv, ctx.userId)
  const result = createReminder(list, input, now, crypto.randomUUID())
  if ('error' in result) return ctx.res.status(400).json({ error: result.error })
  await reschedule(baseUrlFrom(ctx.req), ctx.userId, result.touched)
  await saveReminders(ctx.kv, ctx.userId, result.list)
  return respond(ctx, result.list)
}

async function handlePatch(ctx: Ctx, id: string) {
  const list = await loadReminders(ctx.kv, ctx.userId)
  const result = applyAction(list, id, ctx.req.body, Date.now())
  if ('error' in result) return ctx.res.status(400).json({ error: result.error })
  await reschedule(baseUrlFrom(ctx.req), ctx.userId, result.touched, result.prevMsgId)
  await saveReminders(ctx.kv, ctx.userId, result.list)
  return respond(ctx, result.list)
}

async function handleDelete(ctx: Ctx, id: string) {
  const list = await loadReminders(ctx.kv, ctx.userId)
  await unschedule(list.find((r) => r.id === id))
  const next = list.filter((r) => r.id !== id)
  await saveReminders(ctx.kv, ctx.userId, next)
  return respond(ctx, next)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })
  const kv = await getKv()
  if (!kv) return res.status(501).json({ error: 'Storage not configured.' })
  const ctx: Ctx = { kv, userId, req, res }
  const id = typeof req.query.id === 'string' ? req.query.id : ''

  if (req.method === 'GET') return respond(ctx, await loadReminders(kv, userId))
  if (req.method === 'POST') return handleCreate(ctx)
  if (!id) return res.status(400).json({ error: 'Missing reminder id.' })
  if (req.method === 'PATCH') return handlePatch(ctx, id)
  if (req.method === 'DELETE') return handleDelete(ctx, id)
  return res.status(405).json({ error: 'Method not allowed.' })
}
