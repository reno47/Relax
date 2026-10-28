import { useState } from 'react'
import githubIcon from '../../assets/icons/github.svg'
import { GithubSettings } from './GithubSettings'
import { ContributionFilters } from './ContributionFilters'
import { ContributionHeatmap } from './ContributionHeatmap'
import { PrStats } from './PrStats'
import { LanguagePie } from './LanguagePie'
import { useGithubContributions } from './useGithubContributions'
import { defaultMonthRange, rangeValidationError } from './range'
import type { GithubStatus, Range } from './types'
import './githubContributions.css'

type GithubContributionsProps = {
  onBack: () => void
}

export function GithubContributions({ onBack }: Readonly<GithubContributionsProps>) {
  const [status, setStatus] = useState<GithubStatus>({ configured: false, org: null, login: null })
  const [range, setRange] = useState<Range>(defaultMonthRange)
  const rangeError = rangeValidationError(range)
  const { data, loading, error, refresh } = useGithubContributions(
    status.configured && !rangeError,
    range,
  )

  return (
    <div className="gh-page">
      <header className="gh-page-head">
        <button type="button" className="gh-back" onClick={onBack}>← Back</button>
        <div className="gh-page-title">
          <img src={githubIcon} alt="" className="gh-page-icon" aria-hidden="true" />
          <div>
            <h1>GitHub Contributions</h1>
            <p>Your contribution activity and pull requests, including private work.</p>
          </div>
        </div>
      </header>

      <section className="gh-card">
        <h2 className="gh-card-title">Connection</h2>
        <GithubSettings onStatusChange={setStatus} />
      </section>

      {status.configured && (
        <>
          <ContributionFilters range={range} onChange={setRange} onRefresh={refresh} loading={loading} error={rangeError} />

          {error && <div className="gh-error">{error}</div>}

          {data && (
            <>
              <section className="gh-card">
                <h2 className="gh-card-title">Contribution calendar</h2>
                <ContributionHeatmap calendar={data.calendar} />
              </section>

              <section className="gh-card">
                <h2 className="gh-card-title">Pull requests</h2>
                <PrStats totals={data.totals} repos={data.repos} />
              </section>

              <section className="gh-card">
                <h2 className="gh-card-title">Languages</h2>
                <LanguagePie languages={data.languages} />
              </section>
            </>
          )}

          {loading && !data && <p className="gh-empty">Loading your contributions…</p>}
        </>
      )}
    </div>
  )
}
