export interface WorkItem {
  id: number
  title: string
  iteration: string
  type: string
  state?: string
  url?: string
  order?: number
}

export type AssignedItem = {
  id: number
  title: string
  iteration: string
  type: string
  state: string
  url: string
  order: number
}

export type IterationOption = { path: string; name: string; order: number }

export type TypeBucket = 'feature' | 'story' | 'bug'

export function leafIteration(path: string): string {
  if (!path) return 'No iteration'
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : path
}

export function typeBucket(type: string): TypeBucket {
  const t = (type || '').toLowerCase()
  if (t.includes('bug')) return 'bug'
  if (t.includes('feature')) return 'feature'
  return 'story'
}

export function stateClass(state: string): string {
  const s = (state || '').toLowerCase()
  if (['done', 'closed', 'resolved', 'complete'].some((x) => s.includes(x))) return 'wi-state-done'
  if (['removed', 'cut'].some((x) => s.includes(x))) return 'wi-state-removed'
  if (['active', 'committed', 'progress', 'approved', 'doing'].some((x) => s.includes(x))) return 'wi-state-active'
  if (s.includes('forecast')) return 'wi-state-forecast'
  return 'wi-state-new'
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
