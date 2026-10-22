import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { expect, test } from 'vitest'

import { Brand } from './brand'

function renderBrand(props: ComponentProps<typeof Brand> = {}) {
  const { container } = render(<Brand {...props} />)

  return {
    lightThemeSource: container.querySelector('[data-theme-asset="light"]')?.getAttribute('src'),
    darkThemeSource: container.querySelector('[data-theme-asset="dark"]')?.getAttribute('src'),
  }
}

test('names the full logo and gives each theme its own asset', () => {
  const sources = renderBrand()

  expect(
    screen.getByRole('img', { name: 'Portflow — Steer. Coordinate. Advance.' }),
  ).toBeInTheDocument()
  expect(sources).toEqual({
    lightThemeSource: '/logo-full-light.png',
    darkThemeSource: '/logo-full-dark.png',
  })
})

test('uses the compact mark and names it', () => {
  const sources = renderBrand({ variant: 'mark' })

  expect(screen.getByRole('img', { name: 'Portflow' })).toBeInTheDocument()
  expect(sources).toEqual({
    lightThemeSource: '/logo-light.png',
    darkThemeSource: '/logo-dark.png',
  })
})

test('uses the opposite asset when its tone is inverted', () => {
  const sources = renderBrand({ tone: 'inverse' })

  expect(sources).toEqual({
    lightThemeSource: '/logo-full-dark.png',
    darkThemeSource: '/logo-full-light.png',
  })
})
