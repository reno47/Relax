export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly'

export const REPEATS: Repeat[] = ['none', 'daily', 'weekdays', 'weekly', 'monthly']

export type Reminder = {
  id: string
  text: string
  due: number
  repeat: Repeat
  /** Minutes east of UTC at creation, so repeats keep the user's wall-clock time. */
  tz: number
  createdAt: number
  completedAt?: number
  firedAt?: number
  msgId?: string
}

export type ReminderInput = Pick<Reminder, 'text' | 'due' | 'repeat' | 'tz'>

export const MINUTE_MS = 60_000
export const DAY_MS = 86_400_000
export const COMPLETED_TTL_MS = DAY_MS
export const MAX_TEXT = 500
const MAX_REMINDERS = 200
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEBHOOK_HOSTS = ['.powerplatform.com', '.logic.azure.com', '.webhook.office.com']

function shifted(ms: number, tz: number): Date {
  return new Date(ms + tz * MINUTE_MS)
}

function isWeekend(ms: number, tz: number): boolean {
  const day = shifted(ms, tz).getUTCDay()
  return day === 0 || day === 6
}

function addMonth(ms: number, tz: number): number {
  const d = shifted(ms, tz)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + 1)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return d.getTime() - tz * MINUTE_MS
}

function stepOnce(ms: number, repeat: Repeat, tz: number): number {
  switch (repeat) {
    case 'daily':
      return ms + DAY_MS
    case 'weekly':
      return ms + 7 * DAY_MS
    case 'monthly':
      return addMonth(ms, tz)
    case 'weekdays': {
      let next = ms + DAY_MS
      while (isWeekend(next, tz)) next += DAY_MS
      return next
    }
    default:
      return ms
  }
}

export function nextOccurrence(r: Reminder, now: number): number | null {
  if (r.repeat === 'none') return null
  let next = r.due
  for (let i = 0; i < 5000 && next <= now; i++) next = stepOnce(next, r.repeat, r.tz)
  return next > now ? next : null
}

export function pruneCompleted(list: Reminder[], now: number): Reminder[] {
  return list.filter((r) => !r.completedAt || now - r.completedAt < COMPLETED_TTL_MS)
}

export function needsSchedule(r: Reminder, now: number): boolean {
  return !r.completedAt && !r.firedAt && r.due > now
}

export function isFireable(r: Reminder | undefined, at: number): r is Reminder {
  return Boolean(r && !r.completedAt && !r.firedAt && r.due === at)
}

/** State after a notification for the current occurrence went out. */
export function afterFire(r: Reminder, now: number): Reminder {
  const next = nextOccurrence(r, now)
  if (next !== null) return { ...r, due: next, firedAt: undefined, msgId: undefined }
  return { ...r, firedAt: now, msgId: undefined }
}

export function publicReminder(r: Reminder): Omit<Reminder, 'msgId'> {
  const { msgId: _msgId, ...rest } = r
  return rest
}

export function parseReminderInput(body: unknown, now: number): ReminderInput | string {
  const b = (body ?? {}) as Record<string, unknown>
  const text = typeof b.text === 'string' ? b.text.trim() : ''
  if (!text) return 'Enter what to remind you about.'
  if (text.length > MAX_TEXT) return `Keep it under ${MAX_TEXT} characters.`
  const due = Number(b.due)
  if (!Number.isFinite(due) || due < now - MINUTE_MS) return 'Pick a date and time in the future.'
  if (due > now + 5 * 365 * DAY_MS) return 'Pick a date within the next 5 years.'
  const repeat = (REPEATS as string[]).includes(String(b.repeat)) ? (b.repeat as Repeat) : 'none'
  const tz = Number(b.tz)
  if (!Number.isInteger(tz) || Math.abs(tz) > 14 * 60) return 'Invalid time zone.'
  return { text, due: Math.round(due), repeat, tz }
}

export function createReminder(list: Reminder[], input: ReminderInput, now: number, id: string) {
  if (list.length >= MAX_REMINDERS) return { error: `You can keep up to ${MAX_REMINDERS} reminders.` }
  const r: Reminder = { id, ...input, createdAt: now }
  return { list: [...list, r], touched: r }
}

export type ActionResult =
  | { list: Reminder[]; touched: Reminder; prevMsgId?: string }
  | { error: string }

function applyEdit(r: Reminder, body: unknown, now: number): Reminder | string {
  const input = parseReminderInput(body, now)
  if (typeof input === 'string') return input
  return { ...r, ...input, firedAt: undefined, completedAt: undefined }
}

function applySnooze(r: Reminder, body: Record<string, unknown>, now: number): Reminder | string {
  const until = Number(body.until)
  if (!Number.isFinite(until) || until <= now) return 'Snooze time must be in the future.'
  return { ...r, due: Math.round(until), firedAt: undefined, completedAt: undefined }
}

function transform(r: Reminder, body: Record<string, unknown>, now: number): Reminder | string {
  switch (body.action) {
    case 'complete':
      return { ...r, completedAt: now }
    case 'uncomplete':
      return { ...r, completedAt: undefined }
    case 'snooze':
      return applySnooze(r, body, now)
    case 'edit':
      return applyEdit(r, body, now)
    default:
      return 'Unknown action.'
  }
}

export function applyAction(list: Reminder[], id: string, body: unknown, now: number): ActionResult {
  const current = list.find((r) => r.id === id)
  if (!current) return { error: 'Reminder not found.' }
  const next = transform(current, (body ?? {}) as Record<string, unknown>, now)
  if (typeof next === 'string') return { error: next }
  const touched = { ...next, msgId: undefined }
  return { list: list.map((r) => (r.id === id ? touched : r)), touched, prevMsgId: current.msgId }
}

export function isAllowedWebhook(raw: string): boolean {
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()
    return u.protocol === 'https:' && WEBHOOK_HOSTS.some((h) => host.endsWith(h))
  } catch {
    return false
  }
}

export function formatLocal(ms: number, tz: number): string {
  const d = shifted(ms, tz)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

const REPEAT_LABEL: Record<Repeat, string> = {
  none: '',
  daily: 'Repeats daily',
  weekdays: 'Repeats on weekdays',
  weekly: 'Repeats weekly',
  monthly: 'Repeats monthly',
}

type CardBlock = Record<string, unknown>

function card(body: CardBlock[]) {
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body,
        },
      },
    ],
  }
}

export function buildReminderCard(r: Reminder) {
  const facts = [formatLocal(r.due, r.tz), REPEAT_LABEL[r.repeat]].filter(Boolean).join(' · ')
  return card([
    { type: 'TextBlock', text: '⏰ Reminder', size: 'Small', isSubtle: true },
    { type: 'TextBlock', text: r.text, weight: 'Bolder', size: 'Medium', wrap: true },
    { type: 'TextBlock', text: facts, isSubtle: true, spacing: 'Small', wrap: true },
  ])
}

export function buildTestCard() {
  return card([
    { type: 'TextBlock', text: 'Relax is connected', weight: 'Bolder', size: 'Medium' },
    { type: 'TextBlock', text: 'Your reminders will arrive here.', wrap: true },
  ])
}
