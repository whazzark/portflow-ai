import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { ACTIVE_OPERATIONS_ADMIN } from '../support/fixtures'
import { mockTrucks, renderTrucks } from '../support/test-helpers'

test('opens exact available details and toggles the selection closed', async () => {
  const user = userEvent.setup()
  mockTrucks()
  const { router } = renderTrucks()

  const row = await screen.findByRole('button', { name: /AA-101-PF, Atlantic Transport/ })
  expect(row).toHaveAttribute('aria-pressed', 'false')

  await user.click(row)
  const details = await screen.findByRole('dialog', { name: 'AA-101-PF' })

  expect(within(details).getByText('Volvo FMX')).toBeInTheDocument()
  expect(within(details).getByText('32.5 t')).toBeInTheDocument()
  expect(within(details).getByText('Atlantic Transport')).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({
    truckId: '00000000-0000-4000-8000-000000000101',
  })

  // The open details sheet marks the directory behind it aria-hidden.
  const openedRow = screen.getByRole('button', {
    name: /AA-101-PF, Atlantic Transport/,
    hidden: true,
  })
  // A toggle, as the transport-company rows beside it are: pressed while its truck is the one open.
  expect(openedRow).toHaveAttribute('aria-pressed', 'true')

  await user.click(openedRow)
  await expect.poll(() => router.state.location.search).not.toHaveProperty('truckId')
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument()
  })
  expect(screen.getByRole('list', { name: 'Available trucks' })).toBeInTheDocument()
})

test('restores and aligns archived details with independent company status and context', async () => {
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })
  const { router } = renderTrucks(
    // biome-ignore lint/security/noSecrets: URL state fixture, not a secret
    '/transport-resources?truckStatus=available&truckId=00000000-0000-4000-8000-000000000103',
  )

  const details = await screen.findByRole('dialog', { name: 'CC-303-PF' })
  expect(within(details).getByRole('heading', { name: 'CC-303-PF' })).toBeInTheDocument()
  expect(within(details).getByText('Scania XT')).toBeInTheDocument()
  expect(within(details).getAllByText('Archived company')).toHaveLength(2)
  expect(within(details).getByText('Vehicle retired from the fleet')).toBeInTheDocument()
  await expect.poll(() => router.state.location.search).toMatchObject({ truckStatus: 'archived' })
})

test('shows optional values accurately and clears a stale identity with explicit placeholders', async () => {
  const user = userEvent.setup()
  mockTrucks()
  renderTrucks()
  await user.click(await screen.findByRole('button', { name: /BB-202-PF, Bêta Logistique/ }))

  const details = await screen.findByRole('dialog', { name: 'BB-202-PF' })
  expect(within(details).getAllByText('Not specified').length).toBeGreaterThan(0)
  expect(within(details).getByText('Reactivation context')).toBeInTheDocument()
  expect(within(details).getByText('Vehicle returned to service')).toBeInTheDocument()
  // Each block the truck carries gets its own section, so an archival that was later reversed stays
  // readable beside the reactivation that reversed it.
  expect(within(details).getByText('Archive context')).toBeInTheDocument()

  cleanup()
  mockTrucks()
  const stale = renderTrucks('/transport-resources?truckId=missing')
  await screen.findByRole('list', { name: 'Available trucks' })
  await expect.poll(() => stale.router.state.location.search).not.toHaveProperty('truckId')
})
