import { useState } from 'react'
import type { MyPr, ReviewState } from '../../../api/_myprscore'
import { useMyPrs } from './useMyPrs'
import './myPrs.css'

type Filter = 'all' | 'open' | 'draft'

const DAY_MS = 86_400_000
const STALE_DAYS = 14

const REVIEW_LABEL: Record<ReviewState, string> = {
  approved: 'Approved',
  changes: 'Changes requested',
  waiting: 'Waiting for review',
}

function ageDays(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY_MS))
}

function ageLabel(days: number): string {
  if (days === 0) return 'today'
  if (days === 1) return '1 day old'
  return `${days} days old`
}

function PrRow({ pr, now }: Readonly<{ pr: MyPr; now: number }>) {
  const days = ageDays(pr.createdAt, now)
  const stale = days >= STALE_DAYS
  return (
    <li className={`mpr-row ${stale ? 'stale' : ''}`}>
      <span className={`mpr-state ${pr.isDraft ? 'draft' : 'open'}`}>{pr.isDraft ? 'Draft' : 'Open'}</span>
      <div className="mpr-main">
        <a href={pr.url} target="_blank" rel="noopener noreferrer" className="mpr-title">
          {pr.title}
        </a>
        <span className="mpr-meta">
          <a href={pr.repoUrl} target="_blank" rel="noopener noreferrer">{pr.repo}</a> #{pr.number}
        </span>
      </div>
      <span className={`mpr-review ${pr.review}`}>{REVIEW_LABEL[pr.review]}</span>
      <span className={`mpr-age ${stale ? 'stale' : ''}`} title={`Opened ${new Date(pr.createdAt).toLocaleString()}`}>
        {ageLabel(days)}
      </span>
    </li>
  )
}

type MyOpenPrsProps = {
  enabled?: boolean
}

export function MyOpenPrs({ enabled = true }: Readonly<MyOpenPrsProps>) {
  const { data, loading, error, notConfigured, refresh } = useMyPrs(enabled)
  const [filter, setFilter] = useState<Filter>('all')
  const prs = data?.prs ?? []
  const draftCount = prs.filter((p) => p.isDraft).length
  const openCount = prs.length - draftCount
  const shown = prs.filter((p) => filter === 'all' || (filter === 'draft') === p.isDraft)
  const now = Date.now()

  if (notConfigured) {
    return (
      <p className="mpr-empty">
        Connect GitHub from the profile menu → GitHub Contributions to see your open pull requests.
      </p>
    )
  }

  return (
    <div className="mpr">
      <div className="mpr-toolbar">
        <div className="mpr-filters" role="group" aria-label="Filter pull requests">
          {([
            ['all', `All (${prs.length})`],
            ['open', `Open (${openCount})`],
            ['draft', `Draft (${draftCount})`],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`mpr-chip ${filter === id ? 'active' : ''}`}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {data?.org && <span className="mpr-scope">in {data.org}</span>}
        <button type="button" className="mpr-refresh" onClick={refresh} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="mpr-error">{error}</div>}
      {loading && !data && <p className="mpr-empty">Loading your pull requests…</p>}
      {data && shown.length === 0 && <p className="mpr-empty">No {filter === 'all' ? 'open or draft' : filter} pull requests.</p>}
      {shown.length > 0 && (
        <ul className="mpr-list">
          {shown.map((pr) => (
            <PrRow key={pr.id} pr={pr} now={now} />
          ))}
        </ul>
      )}
    </div>
  )
}
