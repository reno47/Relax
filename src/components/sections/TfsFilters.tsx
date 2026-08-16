import type { IterationOption, TypeBucket } from './tfsUtils'

interface TfsFiltersProps {
  activeTypes: ReadonlySet<TypeBucket>
  onToggleType: (t: TypeBucket) => void
  iterations: IterationOption[]
  selectedIteration: string
  onSelectIteration: (path: string) => void
  onRefresh: () => void
  loading: boolean
}

const TYPES: { value: TypeBucket; label: string }[] = [
  { value: 'feature', label: 'Feature' },
  { value: 'story', label: 'Story' },
  { value: 'bug', label: 'Bug' },
]

export function TfsFilters({
  activeTypes,
  onToggleType,
  iterations,
  selectedIteration,
  onSelectIteration,
  onRefresh,
  loading,
}: Readonly<TfsFiltersProps>) {
  return (
    <div className="tfs-filters">
      <div className="tfs-chips">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            className={`tfs-chip ${activeTypes.has(t.value) ? 'active' : ''}`}
            onClick={() => onToggleType(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <select
        className="tfs-iteration-select"
        value={selectedIteration}
        onChange={(e) => onSelectIteration(e.target.value)}
        aria-label="Filter by iteration"
      >
        <option value="all">All iterations</option>
        {iterations.map((it) => (
          <option key={it.path} value={it.path}>
            {it.name}
          </option>
        ))}
      </select>
      <button type="button" className="tfs-link-btn" onClick={onRefresh} disabled={loading}>
        {loading ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  )
}
