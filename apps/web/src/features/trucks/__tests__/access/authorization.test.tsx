import { fireEvent, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import {
  ACTIVE_OBSERVER,
  ACTIVE_OPERATIONS_ADMIN,
  ACTIVE_OPERATIONS_LEAD,
} from '../support/fixtures'
import { mockTrucks, renderTrucks } from '../support/test-helpers'

test.each([ACTIVE_OBSERVER, ACTIVE_OPERATIONS_LEAD])(
  'uses the available endpoint and normalizes archived URL state for $role',
  async (user) => {
    let completeRequests = 0
    let availableRequests = 0
    mockTrucks({
      user,
      onCompleteRequest: () => {
        completeRequests += 1
      },
      onAvailableRequest: () => {
        availableRequests += 1
      },
    })

    const { router } = renderTrucks('/transport-resources?resource=trucks&truckStatus=archived')

    expect(await screen.findByRole('list', { name: 'Available trucks' })).toBeInTheDocument()
    await expect
      .poll(() => router.state.location.search)
      .toMatchObject({
        resource: 'trucks',
        truckStatus: 'available',
      })
    expect(screen.queryByRole('tab', { name: /Archived/ })).not.toBeInTheDocument()
    expect(completeRequests).toBe(0)
    expect(availableRequests).toBeGreaterThanOrEqual(1)
  },
)

test.each([ACTIVE_OBSERVER, ACTIVE_OPERATIONS_LEAD])(
  'hides the create-truck control for $role',
  async (user) => {
    mockTrucks({ user })

    renderTrucks()

    await screen.findByRole('list', { name: 'Available trucks' })
    expect(screen.queryByRole('button', { name: 'Create truck' })).not.toBeInTheDocument()
  },
)

test.each([ACTIVE_OPERATIONS_ADMIN])('shows the create-truck control for $role', async (user) => {
  mockTrucks({ user })

  renderTrucks()

  expect(await screen.findByRole('button', { name: 'Create truck' })).toBeInTheDocument()
})

test.each([ACTIVE_OBSERVER, ACTIVE_OPERATIONS_LEAD])(
  'hides the archive-truck control for $role',
  async (user) => {
    mockTrucks({ user })

    renderTrucks()
    fireEvent.click(await screen.findByRole('button', { name: 'AA-101-PF, Atlantic Transport' }))

    expect(await screen.findByRole('heading', { name: 'AA-101-PF' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Archive truck' })).not.toBeInTheDocument()
  },
)

test('shows the archive-truck control for an operations administrator', async () => {
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  renderTrucks()
  fireEvent.click(await screen.findByRole('button', { name: 'AA-101-PF, Atlantic Transport' }))

  expect(await screen.findByRole('button', { name: 'Archive truck' })).toBeInTheDocument()
})

test.each([ACTIVE_OBSERVER, ACTIVE_OPERATIONS_LEAD])(
  'never exposes a reactivate-truck control or the archived view for $role, even deep-linked',
  async (user) => {
    mockTrucks({ user })

    const { router } = renderTrucks(
      // biome-ignore lint/security/noSecrets: fixture truck id in a test URL, not a secret
      '/transport-resources?resource=trucks&truckStatus=archived&truckId=00000000-0000-4000-8000-000000000103',
    )

    expect(await screen.findByRole('list', { name: 'Available trucks' })).toBeInTheDocument()
    await expect
      .poll(() => router.state.location.search)
      .toMatchObject({ truckStatus: 'available' })
    expect(screen.queryByRole('tab', { name: /Archived/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate truck' })).not.toBeInTheDocument()
  },
)

test('shows the reactivate-truck control for an operations administrator on an archived truck', async () => {
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  fireEvent.click(screen.getByRole('tab', { name: /Archived/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'CC-303-PF, Coastal Haulage' }))

  expect(await screen.findByRole('button', { name: 'Reactivate truck' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit truck' })).not.toBeInTheDocument()
})

test('uses the complete endpoint and exposes archived consultation to administrators', async () => {
  let completeRequests = 0
  let availableRequests = 0
  mockTrucks({
    user: ACTIVE_OPERATIONS_ADMIN,
    onCompleteRequest: () => {
      completeRequests += 1
    },
    onAvailableRequest: () => {
      availableRequests += 1
    },
  })

  renderTrucks('/transport-resources?resource=trucks&truckStatus=archived')

  expect(await screen.findByRole('list', { name: 'Archived trucks' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Archived \(1\)/ })).toBeInTheDocument()
  expect(completeRequests).toBeGreaterThanOrEqual(1)
  expect(availableRequests).toBe(0)
})
