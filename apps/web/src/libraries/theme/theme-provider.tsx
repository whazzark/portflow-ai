import { createContext, type ReactNode, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

export type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const THEME_STORAGE_KEY = 'portflow-theme'
export const DEFAULT_THEME: Theme = 'dark'

export const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.dataset.theme = theme
}

function readStoredTheme(): Theme {
  // localStorage can throw (private browsing, disabled storage) — fall back to Harbor Control.
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

function readInitialTheme(): Theme {
  if (typeof document === 'undefined') {
    return DEFAULT_THEME
  }

  const bootstrappedTheme = document.documentElement.dataset.theme

  if (bootstrappedTheme === 'light' || bootstrappedTheme === 'dark') {
    return bootstrappedTheme
  }

  return readStoredTheme()
}

function writeStoredTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Preference just won't persist across reloads.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  function setTheme(next: Theme) {
    writeStoredTheme(next)
    applyTheme(next)
    setThemeState(next)
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}
