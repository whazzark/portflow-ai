import { fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { THEME_STORAGE_KEY, ThemeProvider } from '@/libraries/theme/theme-provider'
import { useTheme } from '@/libraries/theme/use-theme'

function ThemeProbe() {
  const { setTheme, theme } = useTheme()

  return (
    <>
      <output>{theme}</output>
      <button type="button" onClick={() => setTheme('light')}>
        Use light theme
      </button>
    </>
  )
}

function renderThemeProvider() {
  return render(
    <ThemeProvider>
      <ThemeProbe />
    </ThemeProvider>,
  )
}

let storedTheme: string | null = null

beforeEach(() => {
  storedTheme = null
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => (key === THEME_STORAGE_KEY ? storedTheme : null),
      setItem: (key: string, value: string) => {
        if (key === THEME_STORAGE_KEY) {
          storedTheme = value
        }
      },
    },
  })
})

afterEach(() => {
  document.documentElement.classList.remove('dark')
  delete document.documentElement.dataset.theme
})

describe('ThemeProvider', () => {
  it('uses dark Harbor Control when no preference is stored', () => {
    renderThemeProvider()

    expect(screen.getByText('dark')).toBeInTheDocument()
    expect(document.documentElement).toHaveClass('dark')
  })

  it('uses a stored light preference', () => {
    storedTheme = 'light'

    renderThemeProvider()

    expect(screen.getByText('light')).toBeInTheDocument()
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('uses the bootstrap theme on the first render', () => {
    document.documentElement.dataset.theme = 'light'

    const html = renderToString(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(html).toContain('<output>light</output>')
  })

  it('synchronizes a changed preference with the document and local storage', () => {
    renderThemeProvider()

    fireEvent.click(screen.getByRole('button', { name: 'Use light theme' }))

    expect(screen.getByText('light')).toBeInTheDocument()
    expect(document.documentElement).not.toHaveClass('dark')
    expect(storedTheme).toBe('light')
  })
})
