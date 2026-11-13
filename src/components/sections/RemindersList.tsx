import { useEffect, useState } from 'react'
import { ReminderForm } from './ReminderForm'
import { TeamsSettings } from './TeamsSettings'
import { REPEAT_BADGE, formatDue, snoozeOptions } from './reminderUtils'
import { useReminders, type ClientReminder, type ReminderAction } from './useReminders'

const TICK_MS = 30_000

function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [])
  return now
}

function sortReminders(list: ClientReminder[]): ClientReminder[] {
  const rank = (r: ClientReminder) => (r.completedAt ? 1 : 0)
  return [...list].sort((a, b) => rank(a) - rank(b) || a.due - b.due)
}

export function RemindersList() {
  const { reminders, teamsConfigured, loading, error, clearError, refresh, add, update, remove } =
    useReminders()
  const now = useNow()
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="rm-panel">
      <TeamsSettings onChange={() => void refresh()} />
      {!loading && !teamsConfigured && (
        <div className="rm-hint">Connect Teams above to get a message when a reminder is due.</div>
      )}

      <ReminderForm submitLabel="Add" onSubmit={add} />
      {error && (
        <div className="tfs-error" role="alert">
          {error}{' '}
          <button type="button" className="tfs-link-btn" onClick={clearError}>
            Dismiss
          </button>
        </div>
      )}

      {!loading && reminders.length === 0 && (
        <div className="rm-empty">No reminders yet. Pick a date and time above.</div>
      )}
      <ul className="rm-list">
        {sortReminders(reminders).map((r) =>
          editingId === r.id ? (
            <li key={r.id} className="rm-item rm-item-edit">
              <ReminderForm
                initial={r}
                submitLabel="Save"
                onCancel={() => setEditingId(null)}
                onSubmit={async (input) => {
                  const ok = await update(r.id, { action: 'edit', ...input })
                  if (ok) setEditingId(null)
                  return ok
                }}
              />
            </li>
          ) : (
            <ReminderRow
              key={r.id}
              reminder={r}
              now={now}
              onAction={(a) => update(r.id, a)}
              onEdit={() => setEditingId(r.id)}
              onDelete={() => remove(r.id)}
            />
          ),
        )}
      </ul>
    </div>
  )
}

interface ReminderRowProps {
  reminder: ClientReminder
  now: number
  onAction: (action: ReminderAction) => Promise<boolean>
  onEdit: () => void
  onDelete: () => void
}

function ReminderRow({ reminder: r, now, onAction, onEdit, onDelete }: Readonly<ReminderRowProps>) {
  const done = Boolean(r.completedAt)
  const overdue = !done && r.due <= now
  return (
    <li className={`rm-item ${done ? 'done' : ''} ${overdue ? 'overdue' : ''}`}>
      <button
        type="button"
        className="rm-check"
        aria-pressed={done}
        aria-label={done ? 'Mark as not done' : 'Mark as done'}
        onClick={() => void onAction({ action: done ? 'uncomplete' : 'complete' })}
      >
        ✓
      </button>
      <div className="rm-body">
        <span className="rm-text">{r.text}</span>
        <span className="rm-meta">
          <span className="rm-due">{formatDue(r.due, now)}</span>
          {r.repeat !== 'none' && <span className="rm-badge">↻ {REPEAT_BADGE[r.repeat]}</span>}
          {done && <span>Removed in 24h</span>}
        </span>
      </div>
      {overdue && (
        <div className="rm-snooze" role="group" aria-label="Snooze">
          <span className="rm-snooze-label">Snooze</span>
          {snoozeOptions(now).map((o) => (
            <button
              key={o.label}
              type="button"
              className="rm-chip"
              onClick={() => void onAction({ action: 'snooze', until: o.until })}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {!done && (
        <button type="button" className="rm-del" aria-label="Edit reminder" title="Edit" onClick={onEdit}>
          ✎
        </button>
      )}
      <button type="button" className="rm-del" aria-label="Delete reminder" title="Delete" onClick={onDelete}>
        ×
      </button>
    </li>
  )
}
