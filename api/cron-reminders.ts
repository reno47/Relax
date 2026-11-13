import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getKv, type Kv } from './_kv.js'
import {
  MAX_DELAY_MS,
  cronBaseUrl,
  fireReminder,
  loadReminders,
  reminderUsers,
  reschedule,
  saveReminders,
} from './_reminders.js'
import type { Reminder } from './_remindercore.js'

function isPending(r: Reminder): boolean {
  return !r.completedAt && !r.firedAt
}

/** Fires anything overdue (safety net) and books QStash for reminders now within 7 days. */
async function processUser(kv: Kv, userId: string, baseUrl: string, now: number) {
  const list = await loadReminders(kv, userId)
  for (const r of list.filter((x) => isPending(x) && x.due <= now)) {
    await fireReminder(kv, userId, r.id, r.due, baseUrl)
  }
  const fresh = await loadReminders(kv, userId)
  const toBook = fresh.filter((r) => isPending(r) && !r.msgId && r.due > now && r.due - now <= MAX_DELAY_MS)
  for (const r of toBook) await reschedule(baseUrl, userId, r)
  await saveReminders(kv, userId, fresh)
  return toBook.length
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const kv = await getKv()
  if (!kv) return res.status(501).json({ error: 'Storage not configured.' })
  const now = Date.now()
  const baseUrl = cronBaseUrl()
  let booked = 0
  for (const userId of await reminderUsers(kv)) booked += await processUser(kv, userId, baseUrl, now)
  return res.status(200).json({ ok: true, booked })
}
