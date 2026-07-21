import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { renderApp } from '@/test/render-app'

test('shows the login screen when there is no valid session', async () => {
  renderApp('/')
  expect(
    await screen.findByRole('heading', { name: 'Keep every handoff on track' }, { timeout: 3_000 }),
  ).toBeInTheDocument()
})
