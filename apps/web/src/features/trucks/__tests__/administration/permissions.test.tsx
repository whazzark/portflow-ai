import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { ACTIVE_OBSERVER, ACTIVE_OPERATIONS_ADMIN, TRUCKS } from '../support/fixtures'
import { mockTrucks, renderTrucks } from '../support/test-helpers'

const archivedTruck = TRUCKS.find((truck) => truck.status === 'ARCHIVED')
if (!archivedTruck) {
  throw new Error('Fixture setup expects at least one archived truck')
}
const [availableTruck] = TRUCKS

test('hides the edit-truck affordance for an observer', async () => {
  mockTrucks({ user: ACTIVE_OBSERVER })

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })

  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
})

test('does not open an edit form for an observer requesting truckMode=edit directly', async () => {
  mockTrucks({ user: ACTIVE_OBSERVER })

  renderTrucks(`/transport-resources?truckId=${availableTruck.id}&truckMode=edit`)

  await screen.findByRole('heading', { name: availableTruck.registration })
  expect(screen.queryByRole('heading', { name: 'Edit truck' })).not.toBeInTheDocument()
})

test('hides the edit-truck affordance for an administrator viewing an archived truck', async () => {
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  renderTrucks(`/transport-resources?truckStatus=archived&truckId=${archivedTruck.id}`)

  await screen.findByRole('heading', { name: archivedTruck.registration })
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
})

test('does not open an edit form for an archived truck requested with truckMode=edit directly', async () => {
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  renderTrucks(
    `/transport-resources?truckStatus=archived&truckId=${archivedTruck.id}&truckMode=edit`,
  )

  await screen.findByRole('heading', { name: archivedTruck.registration })
  expect(screen.queryByRole('heading', { name: 'Edit truck' })).not.toBeInTheDocument()
})
