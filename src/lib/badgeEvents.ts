export const TODOS_CHANGED = 'relax:todos-changed'
export const REMINDERS_CHANGED = 'relax:reminders-changed'

export type BadgeItem = { completedAt?: number }
export type BadgeReminder = BadgeItem & { due: number }

export function emitTodosChanged(todos: BadgeItem[]): void {
  window.dispatchEvent(new CustomEvent<BadgeItem[]>(TODOS_CHANGED, { detail: todos }))
}

export function emitRemindersChanged(reminders: BadgeReminder[]): void {
  window.dispatchEvent(new CustomEvent<BadgeReminder[]>(REMINDERS_CHANGED, { detail: reminders }))
}
