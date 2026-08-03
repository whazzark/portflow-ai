import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { ACTIVE_OPERATIONS_ADMIN, TRUCKS } from '../support/fixtures'
import { mockTrucks, renderTrucks } from '../support/test-helpers'

test('searches registration and company with normalized highlighted matches', async () => {
  const user = userEvent.setup()
  mockTrucks()
  renderTrucks()
  const list = await screen.findByRole('list', { name: 'Available trucks' })
  const search = screen.getByRole('textbox', { name: 'Search trucks' })

  await user.type(search, '  beta  ')
  expect(within(list).getByRole('button', { name: /BB-202-PF/ })).toBeInTheDocument()
  expect(within(list).getByText('Bêta', { selector: 'mark' })).toBeInTheDocument()
  expect(within(list).queryByText('AA-101-PF')).not.toBeInTheDocument()

  await user.clear(search)
  await user.type(search, 'aa-101')
  expect(within(list).getByText('AA-101', { selector: 'mark' })).toBeInTheDocument()
})

test('scopes search to the selected permitted lifecycle and treats whitespace as empty', async () => {
  const user = userEvent.setup()
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })
  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })

  const search = screen.getByRole('textbox', { name: 'Search trucks' })
  await user.type(search, '   ')
  expect(screen.getByText('AA-101-PF')).toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: /Archived \(1\)/ }))
  const archived = await screen.findByRole('list', { name: 'Archived trucks' })
  expect(within(archived).getByText('CC-303-PF')).toBeInTheDocument()
  expect(within(archived).queryByText('AA-101-PF')).not.toBeInTheDocument()
})

test('orders by registration with stable UUID fallback', async () => {
  mockTrucks({
    available: [
      { ...TRUCKS[0], id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', registration: 'SAME-001' },
      { ...TRUCKS[1], id: '00000000-0000-4000-8000-000000000000', registration: 'SAME-001' },
      { ...TRUCKS[0], id: '00000000-0000-4000-8000-000000000010', registration: 'alpha-001' },
    ],
  })

  renderTrucks()
  const list = await screen.findByRole('list', { name: 'Available trucks' })
  const buttons = within(list).getAllByRole('button')

  expect(buttons[0]).toHaveAccessibleName(/alpha-001/)
  expect(buttons.map((button) => button.getAttribute('data-truck-id'))).toEqual([
    '00000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000000',
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
  ])
})
