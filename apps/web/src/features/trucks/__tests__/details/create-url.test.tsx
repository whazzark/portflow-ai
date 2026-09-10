import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { TRANSPORT_COMPANIES } from '@/features/transport-companies/__tests__/support/fixtures'
import { ACTIVE_OBSERVER, ACTIVE_OPERATIONS_ADMIN } from '../support/fixtures'
import { mockTrucks, renderTrucks } from '../support/test-helpers'

/**
 * Truck creation lives in the URL, as transport-company creation already does. Anything an
 * administrator can be halfway through has to survive a reload and be shareable; a create panel
 * held in component state is the one write in the application that could not.
 */

test('records the create mode in the URL when the panel is opened', async () => {
  const user = userEvent.setup()
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  const { router } = renderTrucks()

  await user.click(await screen.findByRole('button', { name: 'Create truck' }))

  await waitFor(() => expect(router.state.location.search).toMatchObject({ truckMode: 'create' }))
  expect(await screen.findByRole('heading', { name: 'Create truck' })).toBeInTheDocument()
})

test('restores the create panel from the URL after a reload', async () => {
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  renderTrucks('/transport-resources?truckMode=create')

  expect(await screen.findByRole('heading', { name: 'Create truck' })).toBeInTheDocument()
  // The form waits for the available transport companies before it can offer a provider, so the
  // fields arrive a tick after the panel does.
  expect(await screen.findByRole('textbox', { name: 'Registration' })).toHaveValue('')
})

test('keeps the transport-company scope when creation is opened from a scoped directory', async () => {
  const user = userEvent.setup()
  const company = TRANSPORT_COMPANIES[0]
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  const { router } = renderTrucks(`/transport-resources?transportCompanyId=${company.id}`)

  await user.click(await screen.findByRole('button', { name: 'Create truck' }))

  // The new parameter merges with what was already there: a scoped directory that lost its scope
  // on opening the panel would create the truck into a list that no longer shows it.
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      transportCompanyId: company.id,
      truckMode: 'create',
    }),
  )
})

test('drops the create mode from the URL when the panel is closed', async () => {
  const user = userEvent.setup()
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  const { router } = renderTrucks('/transport-resources?truckMode=create')

  await screen.findByRole('heading', { name: 'Create truck' })
  await user.keyboard('{Escape}')

  await waitFor(() =>
    expect(router.state.location.search).not.toMatchObject({ truckMode: 'create' }),
  )
  expect(screen.queryByRole('heading', { name: 'Create truck' })).not.toBeInTheDocument()
})

test('does not open the create panel for a non-administrator requesting truckMode=create directly', async () => {
  mockTrucks({ user: ACTIVE_OBSERVER })

  renderTrucks('/transport-resources?truckMode=create')

  await screen.findByRole('list', { name: 'Available trucks' })
  expect(screen.queryByRole('heading', { name: 'Create truck' })).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('opens a truck from the directory under a create mode this page refuses', async () => {
  const user = userEvent.setup()
  mockTrucks({ user: ACTIVE_OBSERVER })

  // The route clears `truckId` under a `truckMode=create` so the two states can never contradict
  // each other. Nothing clears a `create` the page itself refuses, though — a shared or bookmarked
  // URL opened by a non-administrator — so the selection has to say which state it means, or every
  // truck stays unopenable until the address bar is edited by hand.
  const { router } = renderTrucks('/transport-resources?truckMode=create')
  const list = await screen.findByRole('list', { name: 'Available trucks' })

  await user.click(within(list).getByRole('button', { name: /AA-101-PF/ }))

  await waitFor(() => expect(router.state.location.search).toMatchObject({ truckMode: 'view' }))
  expect(await screen.findByRole('heading', { name: 'AA-101-PF' })).toBeInTheDocument()
})
