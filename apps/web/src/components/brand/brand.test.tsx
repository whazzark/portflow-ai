import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { expect, test } from 'vitest'

import { type Theme, ThemeContext } from '@/libraries/theme/theme-provider'

import { Brand } from './brand'

function renderBrand(theme: Theme, props: ComponentProps<typeof Brand> = {}) {
  return render(
    <ThemeContext.Provider value={{ theme, setTheme: () => undefined }}>
      <Brand {...props} />
    </ThemeContext.Provider>,
  )
}

test('uses the light mark on the light theme', () => {
  const { container } = renderBrand('light')

  expect(
    screen.getByRole('img', { name: 'Portflow — Steer. Coordinate. Advance.' }),
  ).toBeInTheDocument()
  expect(container.querySelector('img')).toHaveAttribute('src', '/logo-full-light.png')
})

test('uses the dark mark on the dark theme', () => {
  const { container } = renderBrand('dark')

  expect(container.querySelector('img')).toHaveAttribute('src', '/logo-full-dark.png')
})

test('uses the compact mark and names it', () => {
  const { container } = renderBrand('dark', { variant: 'mark' })

  expect(container.querySelector('img')).toHaveAttribute('src', '/logo-dark.png')
  expect(screen.getByRole('img', { name: 'Portflow' })).toBeInTheDocument()
})

test('uses the opposite asset when its tone is inverted', () => {
  const { container } = renderBrand('dark', { tone: 'inverse' })

  expect(container.querySelector('img')).toHaveAttribute('src', '/logo-full-light.png')
})
