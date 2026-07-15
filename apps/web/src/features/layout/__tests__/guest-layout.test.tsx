import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { renderApp } from '@/test/render-app'

test('renders a decorative port chart on desktop', async () => {
  renderApp('/login')

  await screen.findByRole('heading', { name: 'Keep every handoff on track' })

  const chart = document.querySelector('img[src="/guest-background-image.png"]')

  expect(chart).toHaveAttribute('alt', '')
  expect(chart?.parentElement).toHaveClass('hidden', 'lg:flex', 'lg:min-h-screen')
  expect(screen.getByText('Port operations')).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: 'Every movement, in one operational view' }),
  ).toBeInTheDocument()
  expect(
    screen.getByText(
      'Follow vessels, trucks, weighbridges and terminal activity before a handoff becomes a delay.',
    ),
  ).toBeInTheDocument()
})
