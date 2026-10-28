import type { Range } from './types'

export type DateRange = { from: string; to: string }

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function monthFloor(ym: string): Date {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1))
}

export function monthCeil(ym: string): Date {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0))
}

export function rangeToDates(range: Range): DateRange {
  return { from: ymd(monthFloor(range.from)), to: ymd(monthCeil(range.to)) }
}

export function currentMonth(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`
}

export function defaultMonthRange(): Range {
  const now = new Date()
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1))
  return {
    from: `${from.getUTCFullYear()}-${pad(from.getUTCMonth() + 1)}`,
    to: currentMonth(),
  }
}

export function monthsSpan(range: Range): number {
  const [fy, fm] = range.from.split('-').map(Number)
  const [ty, tm] = range.to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm) + 1
}

export function rangeValidationError(range: Range): string | null {
  if (!range.from || !range.to) return 'Choose a start and end month.'
  if (monthsSpan(range) < 1) return 'Start month must be before the end month.'
  if (monthsSpan(range) > 12) return 'GitHub limits this view to 12 months — pick a shorter range.'
  return null
}
