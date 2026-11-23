import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { renderApp } from '@/test/render-app'

test('renders a decorative port background behind the guest card at every width', async () => {
  renderApp('/login')

  await screen.findByRole('heading', { name: 'Keep every handoff on track' })

  const chart = document.querySelector('img[src="/guest-background-image.png"]')
  const lightChart = document.querySelector('img[src="/guest-background-image-light.png"]')
  const themeVisibility = document.querySelector('style[data-theme-background-visibility]')

  expect(chart).toHaveAttribute('alt', '')
  expect(chart).toHaveClass('hidden', 'dark:block')
  expect(lightChart).toHaveAttribute('alt', '')
  expect(lightChart).toHaveClass('dark:hidden')
  expect(themeVisibility).toHaveTextContent('#guest-background-dark{display:none}')
  expect(themeVisibility).toHaveTextContent('html.dark #guest-background-dark{display:block}')
  // No breakpoint hides the background any more: the card sits over it on a phone too.
  expect(chart?.parentElement?.className).not.toMatch(/(^|\s)hidden(\s|$)/)
  expect(screen.getByText('Port operations')).toBeInTheDocument()
  expect(screen.getByText('Every movement, in one operational view')).toBeInTheDocument()
})

test('renders the guest screen in a centered card', async () => {
  renderApp('/login')

  const heading = await screen.findByRole('heading', { name: 'Keep every handoff on track' })
  const card = heading.closest('[data-slot="guest-card"]')

  expect(card).toBeInTheDocument()
  expect(card).toContainElement(screen.getByRole('button', { name: 'Log in' }))
  expect(card).toContainElement(
    screen.getByRole('img', { name: 'Portflow — Steer. Coordinate. Advance.' }),
  )
})
