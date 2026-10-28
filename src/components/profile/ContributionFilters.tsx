import type { Range } from './types'
import { currentMonth } from './range'

type ContributionFiltersProps = {
  range: Range
  onChange: (range: Range) => void
  onRefresh: () => void
  loading: boolean
  error?: string | null
}

export function ContributionFilters({
  range,
  onChange,
  onRefresh,
  loading,
  error,
}: Readonly<ContributionFiltersProps>) {
  const max = currentMonth()
  return (
    <div className="gh-filters">
      <label className="gh-month-field">
        <span>From</span>
        <input
          type="month"
          className="gh-select"
          value={range.from}
          max={range.to || max}
          onChange={(e) => onChange({ ...range, from: e.target.value })}
        />
      </label>
      <label className="gh-month-field">
        <span>To</span>
        <input
          type="month"
          className="gh-select"
          value={range.to}
          min={range.from}
          max={max}
          onChange={(e) => onChange({ ...range, to: e.target.value })}
        />
      </label>
      <button type="button" className="gh-link-btn" onClick={onRefresh} disabled={loading || Boolean(error)}>
        {loading ? 'Loading…' : 'Refresh'}
      </button>
      {error && <span className="gh-filters-error">{error}</span>}
    </div>
  )
}
