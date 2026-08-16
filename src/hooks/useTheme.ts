import { useEffect } from 'react'
import { useLocalStorage } from './useLocalStorage'

export type Theme = 'light' | 'dark'

export const THEME_KEY = 'dashboard.theme'

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark')
}

export function useTheme() {
  const [theme, setTheme] = useLocalStorage<Theme>(THEME_KEY, 'dark')

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return { theme, setTheme }
}
