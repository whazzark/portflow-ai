import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { mockDocks } from '@/features/checkpoints/__tests__/support/test-helpers'
import { DOCK_ADMIN, DOCK_OBSERVER } from '@/features/docks/__tests__/support/fixtures'
import { renderApp } from '@/test/render-app'

test.each(['OPERATIONS_ADMIN', 'ORGANIZATION_ADMIN'] as const)(
  'links %s users to checkpoint consultation',
  async (role) => {
    mockDocks({ ...DOCK_ADMIN, role })
    renderApp('/')

    expect(await screen.findByRole('link', { name: 'Checkpoints' })).toHaveAttribute(
      'href',
      '/checkpoints',
    )
  },
)

test.each(['OBSERVER', 'OPERATIONS_LEAD'] as const)(
  'does not expose checkpoint consultation navigation to %s users',
  async (role) => {
    mockDocks({ ...DOCK_OBSERVER, role })
    renderApp('/')

    await screen.findAllByRole('link', { name: 'Overview' })
    expect(screen.queryByRole('link', { name: 'Checkpoints' })).not.toBeInTheDocument()
  },
)

test('does not retain the former docks page route', async () => {
  mockDocks(DOCK_ADMIN)
  renderApp('/docks')

  expect(await screen.findByText('Not Found')).toBeInTheDocument()
})
