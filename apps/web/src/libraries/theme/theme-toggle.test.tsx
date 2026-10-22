import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'

import { DropdownMenu, DropdownMenuContent } from '@/components/ui/dropdown-menu'
import { ThemeProvider } from '@/libraries/theme/theme-provider'
import { ThemeToggle } from '@/libraries/theme/theme-toggle'

function renderThemeToggle() {
  return render(
    <ThemeProvider>
      <DropdownMenu open={true}>
        <DropdownMenuContent>
          <ThemeToggle />
        </DropdownMenuContent>
      </DropdownMenu>
    </ThemeProvider>,
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

test('exposes the current appearance and switches the theme', async () => {
  renderThemeToggle()

  const appearance = await screen.findByRole('group', { name: 'Appearance' })
  const dark = within(appearance).getByRole('menuitemradio', { name: 'Dark' })
  const light = within(appearance).getByRole('menuitemradio', { name: 'Light' })

  expect(dark).toHaveAttribute('aria-checked', 'true')
  expect(light).toHaveAttribute('aria-checked', 'false')

  fireEvent.click(light)

  expect(light).toHaveAttribute('aria-checked', 'true')
  expect(dark).toHaveAttribute('aria-checked', 'false')
  expect(document.documentElement).not.toHaveClass('dark')
})
