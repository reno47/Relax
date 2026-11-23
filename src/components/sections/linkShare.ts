export type ShareKind = 'github-links' | 'infra-links'

export type ShareLink = { title: string; url: string; description?: string }

export type ShareSection = {
  title: string
  items: ShareLink[]
  column?: number
  collapsed?: boolean
}

export type ShareFile = {
  app: 'relax'
  kind: ShareKind
  version: 1
  exportedAt: string
  sections: ShareSection[]
}

export type ParseResult = { sections: ShareSection[] } | { error: string }

export const MAX_FILE_BYTES = 1_000_000
const MAX_SECTIONS = 200
const MAX_ITEMS = 500
const KIND_LABEL: Record<ShareKind, string> = { 'github-links': 'GitHub links', 'infra-links': 'Infra links' }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s && s.length <= max ? s : null
}

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

function parseLink(v: unknown): ShareLink | null {
  if (!isRecord(v)) return null
  const title = cleanText(v.title, 200)
  const url = cleanText(v.url, 2000)
  if (!title || !url || !isHttpUrl(url)) return null
  const description = v.description === undefined ? undefined : cleanText(v.description, 500)
  if (description === null) return null
  return description ? { title, url, description } : { title, url }
}

function parseSection(v: unknown): ShareSection | null {
  if (!isRecord(v) || !Array.isArray(v.items) || v.items.length > MAX_ITEMS) return null
  const title = cleanText(v.title, 100)
  if (!title) return null
  const items = v.items.map(parseLink)
  if (items.some((i) => i === null)) return null
  const column = Number.isInteger(v.column) && (v.column as number) >= 0 ? (v.column as number) : undefined
  return { title, items: items as ShareLink[], column, collapsed: v.collapsed === true }
}

function checkHeader(data: unknown, kind: ShareKind): string | null {
  if (!isRecord(data) || data.app !== 'relax') return 'This is not a Relax links file.'
  if (data.kind !== kind) {
    const other = KIND_LABEL[data.kind as ShareKind]
    return other ? `This file contains ${other}, not ${KIND_LABEL[kind]}.` : 'Unknown file type.'
  }
  if (data.version !== 1) return 'This file was made by a newer version of Relax.'
  if (!Array.isArray(data.sections) || data.sections.length > MAX_SECTIONS) return 'The file has no valid sections.'
  return null
}

export function parseShareFile(text: string, kind: ShareKind): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { error: 'The file is not valid JSON.' }
  }
  const headerError = checkHeader(data, kind)
  if (headerError) return { error: headerError }
  const sections = ((data as ShareFile).sections as unknown[]).map(parseSection)
  const bad = sections.findIndex((s) => s === null)
  if (bad >= 0) return { error: `Section ${bad + 1} is invalid (every link needs a title and an http/https URL).` }
  return { sections: sections as ShareSection[] }
}

export function downloadShareFile(kind: ShareKind, sections: ShareSection[]): void {
  const file: ShareFile = { app: 'relax', kind, version: 1, exportedAt: new Date().toISOString(), sections }
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `relax-${kind}-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function countLinks(sections: ShareSection[]): number {
  return sections.reduce((n, s) => n + s.items.length, 0)
}
