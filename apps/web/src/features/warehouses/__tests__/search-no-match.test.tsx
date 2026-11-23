import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { mockWarehouses, renderWarehouses } from './support/test-helpers'

// biome-ignore lint/security/noSecrets: an attribute selector, not a secret
const STATUS_SELECTOR = '[role="status"]'
const statusPanelOf = (element: HTMLElement) => element.closest(STATUS_SELECTOR) as HTMLElement

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('./support/mock-warehouse-map'),
)

test('says nothing matched and offers to include archived warehouses', async () => {
  mockWarehouses()
  const user = userEvent.setup()
  const { router } = renderWarehouses('/warehouses?status=available&search=retired')

  const message = await screen.findByText('No warehouse or door matches “retired”')
  const panel = statusPanelOf(message)

  await user.click(within(panel).getByRole('button', { name: 'Include archived' }))

  await waitFor(() => expect(router.state.location.search).toMatchObject({ status: 'all' }))
  expect(screen.queryByText('No warehouse or door matches “retired”')).not.toBeInTheDocument()
})

test('clears the search from the no-match state', async () => {
  mockWarehouses()
  const user = userEvent.setup()
  // biome-ignore lint/security/noSecrets: route search string, not a secret
  const { router } = renderWarehouses('/warehouses?status=all&search=hangar%209')

  const message = await screen.findByText('No warehouse or door matches “hangar 9”')
  const panel = statusPanelOf(message)

  expect(within(panel).queryByRole('button', { name: 'Include archived' })).not.toBeInTheDocument()
  expect(panel).toHaveTextContent(
    'Search looks at warehouse and door names in the selected status.',
  )

  await user.click(within(panel).getByRole('button', { name: 'Clear search' }))

  await waitFor(() => expect(router.state.location.search).toMatchObject({ search: '' }))
})
