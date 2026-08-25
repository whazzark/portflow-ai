import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { BULK_WAREHOUSES, WAREHOUSE_OBSERVER } from './support/fixtures'
import { mockWarehouses, renderWarehouses } from './support/test-helpers'

vi.mock(
  '@/features/warehouses/map/warehouse-map',
  async () => import('./support/mock-warehouse-map'),
)

const NORTH = BULK_WAREHOUSES[0]

test('Ctrl+A checks every visible available warehouse and enters select mode', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses()

  await screen.findByRole('button', { name: `View warehouse ${NORTH.name} (Available)` })
  await user.keyboard('{Control>}a{/Control}')

  // Three of the four fixtures are available; the archived one is never checkable.
  expect(await screen.findByText('3 selected')).toBeInTheDocument()
})

test('Escape clears the selection without leaving select mode', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses()

  await screen.findByRole('button', { name: `View warehouse ${NORTH.name} (Available)` })
  await user.keyboard('{Control>}a{/Control}')
  expect(await screen.findByText('3 selected')).toBeInTheDocument()

  await user.keyboard('{Escape}')

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
  expect(
    await screen.findByRole('button', { name: 'Stop selecting warehouses' }),
  ).toBeInTheDocument()
})

test('ignores Ctrl+A while a text field has focus', async () => {
  mockWarehouses(undefined, BULK_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses()

  await user.click(await screen.findByRole('textbox', { name: 'Search warehouses' }))
  await user.keyboard('{Control>}a{/Control}')

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})

test('offers no shortcut to an active non-administrator', async () => {
  mockWarehouses(WAREHOUSE_OBSERVER, BULK_WAREHOUSES)
  const user = userEvent.setup()
  renderWarehouses()

  await screen.findByRole('button', { name: `View warehouse ${NORTH.name} (Available)` })
  await user.keyboard('{Control>}a{/Control}')

  expect(screen.queryByRole('button', { name: 'Archive selected' })).not.toBeInTheDocument()
})
