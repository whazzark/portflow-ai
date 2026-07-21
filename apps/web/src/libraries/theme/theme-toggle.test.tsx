import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/libraries/theme/theme-provider'
import { ThemeToggle } from '@/libraries/theme/theme-toggle'

function renderThemeToggle() {
  return render(
    <TooltipProvider>
      <ThemeProvider>
        <SidebarProvider>
          <ThemeToggle />
        </SidebarProvider>
      </ThemeProvider>
    </TooltipProvider>,
  )
}

beforeEach(() => {
  delete document.documentElement.dataset.theme
  document.documentElement.classList.remove('dark')
})

afterEach(() => {
  delete document.documentElement.dataset.theme
  document.documentElement.classList.remove('dark')
})

test('exposes the current appearance and toggles the theme', () => {
  renderThemeToggle()

  const toggle = screen.getByRole('switch', { name: 'Switch to light theme' })

  expect(toggle).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByText('Appearance')).toBeInTheDocument()
  expect(screen.getByText('Dark')).toBeInTheDocument()

  fireEvent.click(toggle)

  expect(screen.getByRole('switch', { name: 'Switch to dark theme' })).toHaveAttribute(
    'aria-checked',
    'false',
  )
  expect(screen.getByText('Light')).toBeInTheDocument()
  expect(document.documentElement).not.toHaveClass('dark')
})
