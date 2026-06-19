import { useState } from 'react'
import lockIcon from '../assets/icons/lock.svg'
import './login.css'

// NOTE: This is a lightweight client-side gate for a personal dashboard, not
// real security — the value is checked in the browser. Do not protect anything
// sensitive with it.
const PASSWORD = '1578963'
const AUTH_KEY = 'dashboard.auth'
const SESSION_MS = 6 * 60 * 60 * 1000 // 6 hours

export function isAuthed(): boolean {
  try {
    const expiry = Number(localStorage.getItem(AUTH_KEY))
    if (!expiry || Date.now() >= expiry) {
      localStorage.removeItem(AUTH_KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(AUTH_KEY)
  } catch {
    /* ignore */
  }
}

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (value === PASSWORD) {
      try {
        localStorage.setItem(AUTH_KEY, String(Date.now() + SESSION_MS))
      } catch {
        /* ignore */
      }
      onSuccess()
    } else {
      setError(true)
      setValue('')
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-icon">
          <img src={lockIcon} alt="" className="login-icon-img" aria-hidden="true" />
        </div>
        <h1 className="login-title">Personal Dashboard</h1>
        <p className="login-subtitle">Enter the password to continue.</p>

        <input
          className={`login-input ${error ? 'has-error' : ''}`}
          type="password"
          inputMode="numeric"
          autoFocus
          placeholder="Password"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (error) setError(false)
          }}
        />

        {error && <div className="login-error">Incorrect password. Try again.</div>}

        <button type="submit" className="login-button" disabled={!value}>
          Unlock
        </button>
      </form>
    </div>
  )
}
