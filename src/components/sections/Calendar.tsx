import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import calendarIcon from '../../assets/icons/calendar.svg'
import './Calendar.css'

// ---------------------------------------------------------------------------
// Types & persistence helpers
// ---------------------------------------------------------------------------
interface Category {
  id: string
  name: string
  color: string
}

type Marks = Record<string, string> // dateKey -> categoryId

const CATEGORIES_KEY = 'dashboard.calendar.categories'
const MARKS_KEY = 'dashboard.calendar.marks'

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'pl', name: 'PL', color: '#4f9cff' },
  { id: 'wfa', name: 'WFA', color: '#a371f7' },
  { id: 'wellness', name: 'Wellness Day', color: '#2ecc71' },
  { id: 'sick', name: 'Sick Leave', color: '#ff5c5c' },
]

const PRESET_COLORS = [
  '#4f9cff', '#a371f7', '#2ecc71', '#ff5c5c', '#ff9f43',
  '#ff5c8a', '#27d3c9', '#f7c948', '#8e9aff', '#9b9b9b',
]

// Earliest year offered by the summary year filter.
const SUMMARY_START_YEAR = 2026

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function pad(n: number) {
  return n.toString().padStart(2, '0')
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CalendarView() {
  const today = new Date()

  const [categories, setCategories] = useState<Category[]>(() =>
    loadJSON(CATEGORIES_KEY, DEFAULT_CATEGORIES),
  )
  const [marks, setMarks] = useState<Marks>(() => loadJSON(MARKS_KEY, {}))

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  // The active "brush": the category applied when a day is clicked.
  const [activeCategory, setActiveCategory] = useState<string | null>(
    () => loadJSON(CATEGORIES_KEY, DEFAULT_CATEGORIES)[0]?.id ?? null,
  )

  // New-category form state
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[4])

  // Summary panel: count marks of a category, filtered by year (or all).
  const [summaryCategory, setSummaryCategory] = useState<string>(
    () => loadJSON(CATEGORIES_KEY, DEFAULT_CATEGORIES)[0]?.id ?? '',
  )
  const [summaryYear, setSummaryYear] = useState<string>(String(today.getFullYear()))

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { getToken } = useAuth()

  // Becomes true once we've tried to load server data, so the save effect
  // below doesn't overwrite the server with stale localStorage values first.
  const [hydrated, setHydrated] = useState(false)

  // On mount: load the source-of-truth from the server (file on disk).
  // This is what makes the data survive across browsers, incognito,
  // cleared site data and dev-server port changes.
  useEffect(() => {
    let cancelled = false
    getToken()
      .then((token) =>
        fetch('/api/calendar', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }),
      )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        if (Array.isArray(data.categories)) setCategories(data.categories)
        if (data.marks && typeof data.marks === 'object') setMarks(data.marks)
      })
      .catch(() => {
        /* server unavailable — keep localStorage cache */
      })
      .finally(() => {
        if (!cancelled) setHydrated(true)
      })
    return () => {
      cancelled = true
    }
  }, [getToken])

  // Persist whenever data changes — to localStorage (fast cache) and to the
  // server file (durable). Nothing is ever auto-deleted.
  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories))
    localStorage.setItem(MARKS_KEY, JSON.stringify(marks))
    getToken()
      .then((token) =>
        fetch('/api/calendar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ categories, marks }),
        }),
      )
      .catch(() => {
        /* offline — localStorage still has the latest copy */
      })
  }, [categories, marks, hydrated, getToken])

  const categoryById = useMemo(() => {
    const map: Record<string, Category> = {}
    for (const c of categories) map[c.id] = c
    return map
  }, [categories])

  // Year filter options: SUMMARY_START_YEAR .. currentYear + 1.
  const summaryYears = useMemo(() => {
    const end = today.getFullYear() + 1
    const ys: number[] = []
    for (let y = SUMMARY_START_YEAR; y <= end; y++) ys.push(y)
    return ys
  }, [today])

  // Fall back to the first category if the selected one was deleted.
  const activeSummaryCat = categories.some((c) => c.id === summaryCategory)
    ? summaryCategory
    : categories[0]?.id ?? ''

  const summaryCount = useMemo(() => {
    if (!activeSummaryCat) return 0
    let n = 0
    for (const [k, v] of Object.entries(marks)) {
      if (v !== activeSummaryCat) continue
      if (summaryYear === 'all' || k.startsWith(`${summaryYear}-`)) n += 1
    }
    return n
  }, [marks, activeSummaryCat, summaryYear])

  // Build the grid of day cells (with leading blanks).
  const cells = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const arr: (number | null)[] = []
    for (let i = 0; i < firstWeekday; i++) arr.push(null)
    for (let d = 1; d <= daysInMonth; d++) arr.push(d)
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [viewYear, viewMonth])

  // --- Actions --------------------------------------------------------------
  function goPrevMonth() {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1)
        return 11
      }
      return m - 1
    })
  }

  function goNextMonth() {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1)
        return 0
      }
      return m + 1
    })
  }

  function goToday() {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
  }

  function handleDayClick(day: number) {
    const key = dateKey(viewYear, viewMonth, day)
    setMarks((prev) => {
      const next = { ...prev }
      if (activeCategory === null) {
        // Eraser mode
        delete next[key]
      } else if (next[key] === activeCategory) {
        // Toggle off if same category clicked again
        delete next[key]
      } else {
        next[key] = activeCategory
      }
      return next
    })
  }

  function addCategory(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const id = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}`
    const category: Category = { id, name, color: newColor }
    setCategories((prev) => [...prev, category])
    setActiveCategory(id)
    setNewName('')
  }

  function deleteCategory(id: string) {
    setCategories((prev) => prev.filter((c) => c.id !== id))
    // Remove marks that used this category so the calendar stays consistent.
    setMarks((prev) => {
      const next: Marks = {}
      for (const [k, v] of Object.entries(prev)) {
        if (v !== id) next[k] = v
      }
      return next
    })
    setActiveCategory((cur) => (cur === id ? null : cur))
  }

  // --- Backup / restore -----------------------------------------------------
  function exportData() {
    const payload = JSON.stringify({ categories, marks }, null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `calendar-backup-${stamp}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-importing the same file later
    if (!file) return
    file
      .text()
      .then((text) => {
        const data = JSON.parse(text)
        if (!Array.isArray(data.categories) || typeof data.marks !== 'object' || data.marks === null) {
          alert('Invalid backup file: expected { categories, marks }.')
          return
        }
        setCategories(data.categories)
        setMarks(data.marks)
        setActiveCategory(data.categories[0]?.id ?? null)
      })
      .catch(() => {
        alert('Could not read that file — it is not valid JSON.')
      })
  }

  const isCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth()

  return (
    <section className="section calendar-section">
      <div className="hero" style={{ ['--section-accent' as string]: 'var(--accent-calendar)' }}>
        <span className="hero-icon">
          <img src={calendarIcon} alt="" className="hero-icon-img" aria-hidden="true" />
        </span>
        <div className="hero-text">
          <h1>Calendar</h1>
          <p>
            Mark dates and assign them a <span className="hero-accent">category</span>. Create your own
            categories with custom colors — everything is saved automatically.
          </p>
        </div>
      </div>

      <div className="calendar-layout">
        {/* ---------------- Sidebar: categories ---------------- */}
        <aside className="cal-sidebar">
          <h3 className="panel-title">Categories</h3>
          <p className="panel-hint">Pick one, then click a day to mark it.</p>

          <div className="category-list">
            {categories.map((c) => (
              <div
                key={c.id}
                className={`category-chip ${activeCategory === c.id ? 'selected' : ''}`}
                style={{ ['--chip-color' as string]: c.color }}
              >
                <button
                  className="chip-main"
                  onClick={() => setActiveCategory(c.id)}
                  title="Select as active mark"
                >
                  <span className="chip-swatch" />
                  <span className="chip-name">{c.name}</span>
                </button>
                <button
                  className="chip-delete"
                  onClick={() => deleteCategory(c.id)}
                  title="Delete category"
                >
                  ✕
                </button>
              </div>
            ))}

            <button
              className={`category-chip eraser ${activeCategory === null ? 'selected' : ''}`}
              onClick={() => setActiveCategory(null)}
              title="Eraser — click a day to clear it"
            >
              <span className="chip-swatch eraser-swatch" />
              <span className="chip-name">Eraser</span>
            </button>
          </div>

          <form className="add-category" onSubmit={addCategory}>
            <h4 className="panel-subtitle">New category</h4>
            <input
              className="cat-name-input"
              type="text"
              placeholder="e.g. Holiday"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={28}
            />
            <div className="color-row">
              {PRESET_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  className={`color-dot ${newColor === col ? 'active' : ''}`}
                  style={{ background: col }}
                  onClick={() => setNewColor(col)}
                  aria-label={`Choose color ${col}`}
                />
              ))}
              <label className="color-custom" title="Custom color">
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                />
              </label>
            </div>
            <button type="submit" className="add-btn" disabled={!newName.trim()}>
              + Add category
            </button>
          </form>

          <div className="backup-section">
            <h4 className="panel-subtitle">Backup</h4>
            <div className="backup-buttons">
              <button type="button" className="backup-btn" onClick={exportData}>
                ⬇ Export
              </button>
              <button
                type="button"
                className="backup-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                ⬆ Import
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={importData}
              hidden
            />
          </div>
        </aside>

        {/* ---------------- Main: month grid ---------------- */}
        <div className="cal-main">
          <div className="cal-summary">
            <div className="summary-controls">
              <label className="summary-field">
                <span>Category</span>
                <select
                  value={activeSummaryCat}
                  onChange={(e) => setSummaryCategory(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="summary-field">
                <span>Year</span>
                <select value={summaryYear} onChange={(e) => setSummaryYear(e.target.value)}>
                  {summaryYears.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                  <option value="all">All</option>
                </select>
              </label>
            </div>
            <div className="summary-result">
              <span
                className="summary-count"
                style={{ color: categoryById[activeSummaryCat]?.color ?? 'var(--accent-calendar)' }}
              >
                {summaryCount}
              </span>
              <span className="summary-label">
                {categoryById[activeSummaryCat]?.name ?? '—'} day{summaryCount === 1 ? '' : 's'}{' '}
                {summaryYear === 'all' ? '(all time)' : `in ${summaryYear}`}
              </span>
            </div>
          </div>

          <div className="cal-toolbar">
            <div className="cal-month-label">
              {MONTHS[viewMonth]} <span className="cal-year">{viewYear}</span>
            </div>
            <div className="cal-nav">
              <button onClick={goPrevMonth} title="Previous month">‹</button>
              <button onClick={goToday} className={isCurrentMonth ? 'today-active' : ''}>
                Today
              </button>
              <button onClick={goNextMonth} title="Next month">›</button>
            </div>
          </div>

          <div className="cal-grid cal-weekdays">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`weekday ${i === 0 || i === 6 ? 'weekend' : ''}`}>{w}</div>
            ))}
          </div>

          <div className="cal-grid cal-days">
            {cells.map((day, i) => {
              if (day === null) return <div key={i} className="day-cell empty" />
              const key = dateKey(viewYear, viewMonth, day)
              const cat = marks[key] ? categoryById[marks[key]] : undefined
              const isToday =
                isCurrentMonth && day === today.getDate()
              const isWeekend = i % 7 === 0 || i % 7 === 6
              return (
                <button
                  key={i}
                  className={`day-cell ${isToday ? 'today' : ''} ${cat ? 'marked' : ''} ${isWeekend ? 'weekend' : ''}`}
                  style={cat ? ({ ['--mark-color' as string]: cat.color }) : undefined}
                  onClick={() => handleDayClick(day)}
                  title={cat ? cat.name : 'Click to mark'}
                >
                  <span className="day-number">{day}</span>
                  {cat && (
                    <span className="day-tag" style={{ background: cat.color }}>
                      {cat.name}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="cal-legend">
            {categories.map((c) => (
              <span key={c.id} className="legend-item">
                <span className="legend-dot" style={{ background: c.color }} />
                {c.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
