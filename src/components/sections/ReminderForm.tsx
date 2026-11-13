import { useState } from 'react'
import type { Repeat, ReminderInput } from '../../../api/_remindercore'
import { REPEAT_OPTIONS, defaultDue, fromLocalInput, toLocalInput, tzOffsetAt } from './reminderUtils'

interface ReminderFormProps {
  initial?: Pick<ReminderInput, 'text' | 'due' | 'repeat'>
  submitLabel: string
  onSubmit: (input: ReminderInput) => Promise<boolean>
  onCancel?: () => void
}

export function ReminderForm({ initial, submitLabel, onSubmit, onCancel }: Readonly<ReminderFormProps>) {
  const [text, setText] = useState(initial?.text ?? '')
  const [when, setWhen] = useState(() => toLocalInput(initial?.due ?? defaultDue()))
  const [repeat, setRepeat] = useState<Repeat>(initial?.repeat ?? 'none')
  const [saving, setSaving] = useState(false)

  const due = fromLocalInput(when)
  const valid = Boolean(text.trim()) && Number.isFinite(due)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setSaving(true)
    const ok = await onSubmit({ text: text.trim(), due, repeat, tz: tzOffsetAt(due) })
    setSaving(false)
    if (ok && !initial) {
      setText('')
      setWhen(toLocalInput(defaultDue()))
      setRepeat('none')
    }
  }

  return (
    <form className="rm-add rm-add-reminder" onSubmit={submit}>
      <input
        className="rm-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Remind me to…"
        maxLength={500}
        aria-label="Reminder text"
      />
      <input
        type="datetime-local"
        className="rm-input rm-when"
        value={when}
        onChange={(e) => setWhen(e.target.value)}
        aria-label="Date and time"
      />
      <select
        className="rm-input rm-repeat"
        value={repeat}
        onChange={(e) => setRepeat(e.target.value as Repeat)}
        aria-label="Repeat"
      >
        {REPEAT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button type="submit" className="btn-primary" disabled={!valid || saving}>
        {saving ? 'Saving…' : submitLabel}
      </button>
      {onCancel && (
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  )
}
