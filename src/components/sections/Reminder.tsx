import { useState } from 'react'
import reminderIcon from '../../assets/icons/reminder.svg'
import { Hero } from './Shared'
import { TodoList } from './TodoList'
import { RemindersList } from './RemindersList'
import './reminder.css'

type Tab = 'todo' | 'reminders'

const TABS: { id: Tab; label: string }[] = [
  { id: 'todo', label: 'To-Do' },
  { id: 'reminders', label: 'Reminders' },
]

const TAB_KEY = 'reminder.tab'

export default function Reminder() {
  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem(TAB_KEY) as Tab | null) ?? 'todo')

  function choose(id: Tab) {
    setTab(id)
    localStorage.setItem(TAB_KEY, id)
  }

  return (
    <section className="section rm-section" style={{ ['--section-accent' as string]: 'var(--accent-reminder)' }}>
      <Hero
        icon={<img src={reminderIcon} alt="" className="hero-icon-img" aria-hidden="true" />}
        accent="var(--accent-reminder)"
        title={<>Reminder</>}
      />
      <div className="rm-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`rm-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => choose(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{tab === 'todo' ? <TodoList /> : <RemindersList />}</div>
    </section>
  )
}
