import { useEffect, useState } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'

interface Todo {
  id: string
  text: string
  createdAt: number
  completedAt?: number
}

const DONE_TTL_MS = 86_400_000
const PRUNE_EVERY_MS = 60_000

function prune(list: Todo[], now: number): Todo[] {
  return list.filter((t) => !t.completedAt || now - t.completedAt < DONE_TTL_MS)
}

export function TodoList() {
  const [todos, setTodos] = useLocalStorage<Todo[]>('dashboard.todos', [])
  const [text, setText] = useState('')

  useEffect(() => {
    const run = () =>
      setTodos((prev) => {
        const next = prune(prev, Date.now())
        return next.length === prev.length ? prev : next
      })
    run()
    const timer = setInterval(run, PRUNE_EVERY_MS)
    return () => clearInterval(timer)
  }, [setTodos])

  function add(e: React.FormEvent) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    setTodos((prev) => [{ id: crypto.randomUUID(), text: value, createdAt: Date.now() }, ...prev])
    setText('')
  }

  function toggle(id: string) {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completedAt: t.completedAt ? undefined : Date.now() } : t)),
    )
  }

  function remove(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id))
  }

  const ordered = [...todos.filter((t) => !t.completedAt), ...todos.filter((t) => t.completedAt)]

  return (
    <div className="rm-panel">
      <form className="rm-add" onSubmit={add}>
        <input
          className="rm-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a to-do…"
          maxLength={500}
          aria-label="New to-do"
        />
        <button type="submit" className="btn-primary" disabled={!text.trim()}>
          Add
        </button>
      </form>

      {ordered.length === 0 ? (
        <div className="rm-empty">Nothing to do. Add your first to-do above.</div>
      ) : (
        <ul className="rm-list">
          {ordered.map((t) => (
            <li key={t.id} className={`rm-item ${t.completedAt ? 'done' : ''}`}>
              <button
                type="button"
                className="rm-check"
                aria-pressed={Boolean(t.completedAt)}
                aria-label={t.completedAt ? 'Mark as not done' : 'Mark as done'}
                onClick={() => toggle(t.id)}
              >
                ✓
              </button>
              <span className="rm-text">{t.text}</span>
              {t.completedAt && <span className="rm-meta">Removed in 24h</span>}
              <button
                type="button"
                className="rm-del"
                aria-label="Delete to-do"
                title="Delete"
                onClick={() => remove(t.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
