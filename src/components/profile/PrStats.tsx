import type { RepoStat, Totals } from './types'

type PrStatsProps = {
  totals: Totals
  repos: RepoStat[]
}

const CARDS: { key: keyof Totals; label: string; cls: string }[] = [
  { key: 'open', label: 'Open', cls: 'open' },
  { key: 'draft', label: 'Draft', cls: 'draft' },
  { key: 'merged', label: 'Merged', cls: 'merged' },
  { key: 'closed', label: 'Closed', cls: 'closed' },
]

export function PrStats({ totals, repos }: Readonly<PrStatsProps>) {
  return (
    <div className="gh-prstats">
      <div className="gh-stat-cards">
        {CARDS.map((c) => (
          <div className={`gh-stat-card ${c.cls}`} key={c.key}>
            <span className="gh-stat-value">{totals[c.key]}</span>
            <span className="gh-stat-label">{c.label} PRs</span>
          </div>
        ))}
      </div>

      {repos.length === 0 ? (
        <p className="gh-empty">No pull requests for this range.</p>
      ) : (
        <table className="gh-repo-table">
          <thead>
            <tr>
              <th>Repository</th>
              <th>Open</th>
              <th>Draft</th>
              <th>Merged</th>
              <th>Closed</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {repos.map((r) => (
              <tr key={r.name}>
                <td>
                  <a href={r.url} target="_blank" rel="noreferrer">{r.name}</a>
                </td>
                <td>{r.open}</td>
                <td>{r.draft}</td>
                <td>{r.merged}</td>
                <td>{r.closed}</td>
                <td><strong>{r.total}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
