import type { Repeat } from '../../../api/_remindercore'

const DAY_MS = 86_400_000

export const REPEAT_OPTIONS: { value: Repeat; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Every weekday (Mon–Fri)' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
]

export const REPEAT_BADGE: Record<Repeat, string> = {
  none: '',
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

const pad = (n: number) => String(n).padStart(2, '0')

export function toLocalInput(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInput(value: string): number {
  return value ? new Date(value).getTime() : Number.NaN
}

export function tzOffsetAt(ms: number): number {
  return -new Date(ms).getTimezoneOffset()
}

export function defaultDue(now = Date.now()): number {
  const d = new Date(now + 3_600_000)
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0)
  return d.getTime()
}

function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function dayLabel(ms: number, now: number): string {
  const diff = Math.round((startOfDay(ms) - startOfDay(now)) / DAY_MS)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear()
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

export function formatDue(ms: number, now: number): string {
  const time = new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${dayLabel(ms, now)}, ${time}`
}

export function snoozeOptions(now: number): { label: string; until: number }[] {
  const tomorrow = new Date(now + DAY_MS)
  tomorrow.setHours(9, 0, 0, 0)
  return [
    { label: '10 min', until: now + 10 * 60_000 },
    { label: '1 hour', until: now + 3_600_000 },
    { label: 'Tomorrow 9:00', until: tomorrow.getTime() },
  ]
}
