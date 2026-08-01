import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { mockDocks } from '@/features/checkpoints/__tests__/support/test-helpers'
import { DOCK_ADMIN, DOCK_OBSERVER } from '@/features/docks/__tests__/support/fixtures'
import { renderApp } from '@/test/render-app'

test('links authorized administrators to checkpoint consultation', async () => {
  mockDocks(DOCK_ADMIN)
  renderApp('/')

  expect(await screen.findByRole('link', { name: 'Checkpoints' })).toHaveAttribute(
    'href',
    '/checkpoints',
  )
})

test('does not expose dock consultation navigation to observers', async () => {
  mockDocks(DOCK_OBSERVER)
  renderApp('/')

  await screen.findAllByRole('link', { name: 'Overview' })
  expect(screen.queryByRole('link', { name: 'Checkpoints' })).not.toBeInTheDocument()
})

test('does not retain the former docks page route', async () => {
  mockDocks(DOCK_ADMIN)
  renderApp('/docks')

  expect(await screen.findByText('Not Found')).toBeInTheDocument()
})
