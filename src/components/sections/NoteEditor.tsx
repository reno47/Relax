import { useEffect, useRef, useState } from 'react'

interface NoteEditorProps {
  html: string
  onChange: (html: string) => void
}

const URL_RE = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]|www\.[^\s<>()]+[^\s<>().,;:!?'"])/gi

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function linkifyToHtml(text: string): string {
  let result = ''
  let lastIndex = 0
  for (const match of text.matchAll(URL_RE)) {
    const url = match[0]
    const start = match.index ?? 0
    const href = url.startsWith('http') ? url : `https://${url}`
    result += escapeHtml(text.slice(lastIndex, start))
    result += `<a href="${escapeHtml(encodeURI(href))}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`
    lastIndex = start + url.length
  }
  result += escapeHtml(text.slice(lastIndex))
  return result.replace(/\n/g, '<br>')
}

const SIZE_PRESETS = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '36', '48', '72']

const COLOR_PRESETS = [
  '#e6edf3', '#aab3c2', '#6b7585', '#0a0e14', '#ff5c5c', '#ff9f43',
  '#f7c948', '#2ecc71', '#27d3c9', '#4f9cff', '#5b8db8', '#a371f7',
  '#ff5c8a', '#c0392b', '#16a085', '#2c3e50',
]

export function NoteEditor({ html, onChange }: Readonly<NoteEditorProps>) {
  const ref = useRef<HTMLDivElement>(null)
  const savedRange = useRef<Range | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const [sizeValue, setSizeValue] = useState('16')
  const [sizeOpen, setSizeOpen] = useState(false)
  const sizeWrap = useRef<HTMLDivElement>(null)
  const [colorOpen, setColorOpen] = useState(false)
  const colorWrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html || ''

  }, [])

  useEffect(() => {
    if (!sizeOpen) return
    const onDown = (e: MouseEvent) => {
      if (sizeWrap.current && !sizeWrap.current.contains(e.target as Node)) setSizeOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [sizeOpen])

  useEffect(() => {
    if (!colorOpen) return
    const onDown = (e: MouseEvent) => {
      if (colorWrap.current && !colorWrap.current.contains(e.target as Node)) setColorOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [colorOpen])

  function flush() {
    if (ref.current) onChange(ref.current.innerHTML)
  }

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(flush, 400)
  }

  function saveSelection() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0)
    }
  }

  function restoreSelection() {
    const sel = window.getSelection()
    if (sel && savedRange.current) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }
  }

  function exec(command: string, value?: string) {
    restoreSelection()
    document.execCommand(command, false, value)
    ref.current?.focus()
    scheduleSave()
  }

  function applyFontSize(px: string) {
    const size = parseInt(px, 10)
    if (!size || size < 1) return
    restoreSelection()
    document.execCommand('fontSize', false, '7')
    ref.current?.querySelectorAll('font[size="7"]').forEach((el) => {
      el.removeAttribute('size')
      ;(el as HTMLElement).style.fontSize = `${size}px`
    })
    ref.current?.focus()
    scheduleSave()
  }

  function applyColor(color: string) {
    exec('foreColor', color)
  }

  function insertLink() {
    const url = window.prompt('Enter URL')
    if (!url) return
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
    restoreSelection()
    const sel = window.getSelection()
    if (sel && sel.isCollapsed) {
      const safe = escapeHtml(encodeURI(href))
      document.execCommand('insertHTML', false, `<a href="${safe}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`)
    } else {
      document.execCommand('createLink', false, href)
      ref.current?.querySelectorAll('a').forEach((a) => {
        a.setAttribute('target', '_blank')
        a.setAttribute('rel', 'noopener noreferrer')
      })
    }
    ref.current?.focus()
    scheduleSave()
  }

  function onPaste(e: React.ClipboardEvent) {
    const image = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
    if (image) {
      e.preventDefault()
      const file = image.getAsFile()
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        restoreSelection()
        document.execCommand('insertImage', false, String(reader.result))
        scheduleSave()
      }
      reader.readAsDataURL(file)
      return
    }

    const text = e.clipboardData.getData('text/plain')
    if (!text || !/(https?:\/\/|www\.)/i.test(text)) return
    e.preventDefault()
    restoreSelection()
    document.execCommand('insertHTML', false, linkifyToHtml(text))
    scheduleSave()
  }

  function onClick(e: React.MouseEvent) {
    if (!e.ctrlKey && !e.metaKey) return
    const anchor = (e.target as HTMLElement).closest('a')
    const href = anchor?.getAttribute('href')
    if (!href) return
    e.preventDefault()
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  const btn = (cmd: string, label: string, title: string, value?: string) => (
    <button
      type="button"
      className="note-tool"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => exec(cmd, value)}
    >
      {label}
    </button>
  )

  return (
    <div className="note-editor">
      <div className="note-toolbar">
        {btn('bold', 'B', 'Bold')}
        {btn('italic', 'I', 'Italic')}
        {btn('underline', 'U', 'Underline')}
        {btn('strikeThrough', 'S', 'Strikethrough')}
        <button
          type="button"
          className="note-tool"
          title="Insert link (select text first, or insert a new one)"
          onMouseDown={(e) => {
            e.preventDefault()
            saveSelection()
          }}
          onClick={insertLink}
        >
          🔗
        </button>
        <span className="note-tool-sep" />

        <div className="note-size-wrap" ref={sizeWrap} title="Font size (px) — pick or type">
          <input
            className="note-size-input"
            type="text"
            inputMode="numeric"
            value={sizeValue}
            onMouseDown={saveSelection}
            onChange={(e) => setSizeValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyFontSize(sizeValue)
              }
            }}
          />
          <button
            type="button"
            className="note-size-caret"
            title="Size presets"
            onMouseDown={(e) => {
              e.preventDefault()
              saveSelection()
            }}
            onClick={() => setSizeOpen((o) => !o)}
          >
            ▾
          </button>
          <button
            type="button"
            className="note-tool note-size-apply"
            title="Apply size"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFontSize(sizeValue)}
          >
            Aa
          </button>
          {sizeOpen && (
            <div className="note-size-pop">
              {SIZE_PRESETS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="note-size-opt"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSizeValue(s)
                    applyFontSize(s)
                    setSizeOpen(false)
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="note-color-wrap" ref={colorWrap}>
          <button
            type="button"
            className="note-tool note-color-btn"
            title="Text color"
            onMouseDown={(e) => {
              e.preventDefault()
              saveSelection()
            }}
            onClick={() => setColorOpen((o) => !o)}
          >
            A<span className="note-color-underline" />
          </button>
          {colorOpen && (
            <div className="note-color-pop">
              <div className="note-swatches">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="note-swatch"
                    style={{ background: c }}
                    title={c}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      applyColor(c)
                      setColorOpen(false)
                    }}
                  />
                ))}
              </div>
              <label className="note-color-custom">
                <span className="note-color-ring" />
                Custom color
                <input
                  type="color"
                  onMouseDown={saveSelection}
                  onChange={(e) => applyColor(e.target.value)}
                />
              </label>
            </div>
          )}
        </div>

        <span className="note-tool-sep" />
        {btn('insertUnorderedList', '•', 'Bulleted list')}
        {btn('insertOrderedList', '1.', 'Numbered list')}
        <span className="note-tool-sep" />
        {btn('justifyLeft', '⯇', 'Align left')}
        {btn('justifyCenter', '≡', 'Align center')}
        {btn('justifyRight', '⯈', 'Align right')}
      </div>

      <div
        ref={ref}
        className="note-body"
        contentEditable
        suppressContentEditableWarning
        onInput={scheduleSave}
        onBlur={flush}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onPaste={onPaste}
        onClick={onClick}
        data-placeholder="Start typing… paste text or images here."
      />
    </div>
  )
}
