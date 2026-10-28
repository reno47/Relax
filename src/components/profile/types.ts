export type PrBucket = 'open' | 'draft' | 'merged' | 'closed'

export type CalendarDay = { date: string; color: string; count: number; weekday: number }
export type Calendar = { totalContributions: number; weeks: { days: CalendarDay[] }[] }
export type Totals = { open: number; draft: number; merged: number; closed: number; total: number }
export type RepoStat = {
  name: string
  url: string
  language: string | null
  languageColor: string | null
  open: number
  draft: number
  merged: number
  closed: number
  total: number
}
export type LanguageStat = { name: string; color: string | null; count: number }
export type Contributions = {
  login: string
  calendar: Calendar
  totals: Totals
  repos: RepoStat[]
  languages: LanguageStat[]
}

export type GithubStatus = { configured: boolean; org: string | null; login: string | null }

export type Range = { from: string; to: string }
