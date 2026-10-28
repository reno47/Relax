import type { LanguageStat } from './types'

type LanguagePieProps = {
  languages: LanguageStat[]
}

const PALETTE = ['#6ea8fe', '#63e6be', '#ffd43b', '#ff8787', '#b197fc', '#ffa94d', '#74c0fc', '#8ce99a']
const RADIUS = 60
const STROKE = 28
const CIRC = 2 * Math.PI * RADIUS

type Segment = { name: string; color: string; count: number; pct: number; offset: number }

function buildSegments(languages: LanguageStat[]): { segments: Segment[]; total: number } {
  const total = languages.reduce((sum, l) => sum + l.count, 0)
  let acc = 0
  const segments = languages.map((l, i) => {
    const pct = total ? l.count / total : 0
    const seg: Segment = {
      name: l.name,
      color: l.color ?? PALETTE[i % PALETTE.length],
      count: l.count,
      pct,
      offset: acc,
    }
    acc += pct
    return seg
  })
  return { segments, total }
}

export function LanguagePie({ languages }: Readonly<LanguagePieProps>) {
  const { segments, total } = buildSegments(languages)
  if (!total) return <p className="gh-empty">No language data for this range.</p>

  return (
    <div className="gh-pie">
      <svg viewBox="0 0 160 160" className="gh-pie-svg" role="img" aria-label="Language distribution">
        <g transform="rotate(-90 80 80)">
          {segments.map((s) => (
            <circle
              key={s.name}
              cx="80"
              cy="80"
              r={RADIUS}
              fill="none"
              stroke={s.color}
              strokeWidth={STROKE}
              strokeDasharray={`${s.pct * CIRC} ${CIRC}`}
              strokeDashoffset={-s.offset * CIRC}
            />
          ))}
        </g>
        <text x="80" y="76" className="gh-pie-total">{total}</text>
        <text x="80" y="94" className="gh-pie-caption">PRs</text>
      </svg>
      <ul className="gh-pie-legend">
        {segments.map((s) => (
          <li key={s.name}>
            <span className="gh-pie-dot" style={{ background: s.color }} />
            <span className="gh-pie-name">{s.name}</span>
            <span className="gh-pie-pct">{Math.round(s.pct * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
