export interface WorkItem {
  id: number
  title: string
  iteration: string
  type: string
  url?: string
}

export function leafIteration(path: string): string {
  if (!path) return 'No iteration'
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : path
}

export function typeClass(type: string): string {
  const t = (type || '').toLowerCase()
  if (t.includes('bug')) return 'wi-bug'
  if (t.includes('feature')) return 'wi-feature'
  if (t.includes('epic')) return 'wi-epic'
  if (t.includes('task')) return 'wi-task'
  if (t.includes('story') || t.includes('backlog')) return 'wi-story'
  return 'wi-generic'
}
