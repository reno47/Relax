import githubIcon from '../../assets/icons/github.svg'
import { MyOpenPrs } from './MyOpenPrs'
import './githubContributions.css'

type MyPrsPageProps = {
  onBack: () => void
}

export function MyPrsPage({ onBack }: Readonly<MyPrsPageProps>) {
  return (
    <div className="gh-page">
      <header className="gh-page-head">
        <button type="button" className="gh-back" onClick={onBack}>← Back</button>
        <div className="gh-page-title">
          <img src={githubIcon} alt="" className="gh-page-icon" aria-hidden="true" />
          <div>
            <h1>My Open PRs</h1>
            <p>Your open and draft pull requests, so nothing gets forgotten.</p>
          </div>
        </div>
      </header>

      <section className="gh-card">
        <MyOpenPrs />
      </section>
    </div>
  )
}
