import type { Calendar } from './types'
import { MONTH_LABELS } from './range'

type ContributionHeatmapProps = {
  calendar: Calendar
}

type MonthBlock = { key: string; label: string; weeks: Calendar['weeks'] }

const LEGEND = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']

function groupByMonth(calendar: Calendar): MonthBlock[] {
  const blocks: MonthBlock[] = []
  for (const week of calendar.weeks) {
    const first = week.days[0]
    if (!first) continue
    const d = new Date(`${first.date}T00:00:00Z`)
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`
    const last = blocks.at(-1)
    if (last?.key === key) last.weeks.push(week)
    else blocks.push({ key, label: MONTH_LABELS[d.getUTCMonth()], weeks: [week] })
  }
  return blocks
}

export function ContributionHeatmap({ calendar }: Readonly<ContributionHeatmapProps>) {
  const blocks = groupByMonth(calendar)
  return (
    <div className="gh-heatmap">
      <div className="gh-heatmap-scroll">
        <div className="gh-heatmap-months-row">
          {blocks.map((block) => (
            <div className="gh-month-block" key={block.key}>
              <span className="gh-heatmap-month">{block.label}</span>
              <div className="gh-heatmap-grid">
                {block.weeks.map((week, wi) => (
                  <div className="gh-heatmap-week" key={week.days[0]?.date ?? wi}>
                    {week.days.map((day) => (
                      <span
                        key={day.date}
                        className="gh-heatmap-day"
                        style={{ gridRow: day.weekday + 1, background: day.color }}
                        title={`${day.count} contribution${day.count === 1 ? '' : 's'} on ${day.date}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="gh-heatmap-footer">
        <span>{calendar.totalContributions.toLocaleString()} contributions</span>
        <div className="gh-heatmap-legend">
          <span>Less</span>
          {LEGEND.map((c) => (
            <span key={c} className="gh-heatmap-day" style={{ background: c }} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  )
}
