import { fireEvent, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { TRANSPORT_COMPANIES } from '@/features/transport-companies/__tests__/support/fixtures'
import type { TruckDto } from '@/features/trucks/types'
import { server } from '@/test/msw/server'
import {
  ACTIVE_OPERATIONS_ADMIN,
  API_BASE_URL,
  AVAILABLE_TRUCKS,
  TRUCKS,
} from '../support/fixtures'
import { mockTrucks, renderTrucks } from '../support/test-helpers'

const [target] = TRUCKS

async function openTruckDetails(registration: string, companyName: string) {
  fireEvent.click(await screen.findByRole('button', { name: `${registration}, ${companyName}` }))
}

test('lets an administrator open, pre-fill, and save a correction in the detail pane', async () => {
  const updated: TruckDto = {
    ...target,
    registration: 'UPDATED-01',
    vehicleModel: 'Volvo FH16',
    capacityTonnes: 38.5,
    updatedAt: '2026-08-24T00:00:00.000Z',
  }
  let currentComplete = TRUCKS
  let currentAvailable = AVAILABLE_TRUCKS

  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })
  server.use(
    http.get(`${API_BASE_URL}/api/v1/trucks`, () => HttpResponse.json({ data: currentComplete })),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () =>
      HttpResponse.json({ data: currentAvailable }),
    ),
    http.patch(`${API_BASE_URL}/api/v1/trucks/${target.id}`, () => {
      currentComplete = currentComplete.map((truck) => (truck.id === target.id ? updated : truck))
      currentAvailable = currentAvailable.map((truck) => (truck.id === target.id ? updated : truck))
      return HttpResponse.json({ data: updated })
    }),
  )

  renderTrucks()
  await openTruckDetails(target.registration, 'Atlantic Transport')
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))

  expect(await screen.findByRole('heading', { name: 'Edit truck' })).toBeInTheDocument()
  expect(await screen.findByRole('textbox', { name: 'Registration' })).toHaveValue(
    target.registration,
  )
  expect(screen.getByRole('textbox', { name: 'Capacity (tonnes)' })).toHaveValue(
    String(target.capacityTonnes),
  )
  expect(screen.getByRole('textbox', { name: 'Vehicle model' })).toHaveValue(
    target.vehicleModel ?? '',
  )
  expect(screen.getByRole('combobox', { name: 'Transport company' })).toHaveTextContent(
    'Atlantic Transport',
  )

  fireEvent.change(screen.getByRole('textbox', { name: 'Registration' }), {
    target: { value: updated.registration },
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'Vehicle model' }), {
    target: { value: updated.vehicleModel ?? '' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'Capacity (tonnes)' }), {
    target: { value: String(updated.capacityTonnes) },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByRole('heading', { name: updated.registration })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit truck' })).not.toBeInTheDocument()
})

test('survives a reload while the edit form is open', async () => {
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  renderTrucks(`/transport-resources?truckId=${target.id}&truckMode=edit`)

  expect(await screen.findByRole('heading', { name: 'Edit truck' })).toBeInTheDocument()
  expect(await screen.findByRole('textbox', { name: 'Registration' })).toHaveValue(
    target.registration,
  )
})

test('lets an administrator cancel an edit without changing the truck', async () => {
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  renderTrucks()
  await openTruckDetails(target.registration, 'Atlantic Transport')
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  expect(await screen.findByRole('heading', { name: 'Edit truck' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Back to details' }))

  expect(await screen.findByRole('heading', { name: target.registration })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit truck' })).not.toBeInTheDocument()
})

test('shows the corrected truck in the embedded workspace layout', async () => {
  const updated: TruckDto = { ...target, registration: 'EMBEDDED-01' }
  let currentComplete = TRUCKS
  let currentAvailable = AVAILABLE_TRUCKS

  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })
  server.use(
    http.get(`${API_BASE_URL}/api/v1/trucks`, () => HttpResponse.json({ data: currentComplete })),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () =>
      HttpResponse.json({ data: currentAvailable }),
    ),
    http.patch(`${API_BASE_URL}/api/v1/trucks/${target.id}`, () => {
      currentComplete = currentComplete.map((truck) => (truck.id === target.id ? updated : truck))
      currentAvailable = currentAvailable.map((truck) => (truck.id === target.id ? updated : truck))
      return HttpResponse.json({ data: updated })
    }),
  )

  renderTrucks('/transport-resources')
  await openTruckDetails(target.registration, 'Atlantic Transport')
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  fireEvent.change(await screen.findByRole('textbox', { name: 'Registration' }), {
    target: { value: updated.registration },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() =>
    expect(screen.queryByRole('heading', { name: 'Edit truck' })).not.toBeInTheDocument(),
  )
  expect(await screen.findByRole('heading', { name: updated.registration })).toBeInTheDocument()
})

test('offers the available companies and the truck own current company, pre-selected', async () => {
  const archivedCompanyTruck = TRUCKS.find((truck) => {
    const company = TRANSPORT_COMPANIES.find((item) => item.id === truck.transportCompanyId)
    return company?.status === 'AVAILABLE'
  })
  if (!archivedCompanyTruck) {
    throw new Error('Fixture setup expects at least one truck on an available company')
  }
  const company = TRANSPORT_COMPANIES.find(
    (item) => item.id === archivedCompanyTruck.transportCompanyId,
  )

  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })
  renderTrucks()
  await openTruckDetails(archivedCompanyTruck.registration, company?.name ?? '')
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  fireEvent.click(await screen.findByRole('combobox', { name: 'Transport company' }))

  expect(await screen.findByRole('option', { name: 'Atlantic Transport' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Bêta Logistique' })).toBeInTheDocument()
})

test('reassigns a truck to another available transport company', async () => {
  const updated: TruckDto = { ...target, transportCompanyId: TRANSPORT_COMPANIES[1].id }
  let currentComplete = TRUCKS
  let currentAvailable = AVAILABLE_TRUCKS

  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })
  server.use(
    http.get(`${API_BASE_URL}/api/v1/trucks`, () => HttpResponse.json({ data: currentComplete })),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () =>
      HttpResponse.json({ data: currentAvailable }),
    ),
    http.patch(`${API_BASE_URL}/api/v1/trucks/${target.id}`, () => {
      currentComplete = currentComplete.map((truck) => (truck.id === target.id ? updated : truck))
      currentAvailable = currentAvailable.map((truck) => (truck.id === target.id ? updated : truck))
      return HttpResponse.json({ data: updated })
    }),
  )

  renderTrucks()
  await openTruckDetails(target.registration, 'Atlantic Transport')
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  fireEvent.click(await screen.findByRole('combobox', { name: 'Transport company' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Bêta Logistique' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() =>
    expect(screen.queryByRole('heading', { name: 'Edit truck' })).not.toBeInTheDocument(),
  )
  // The details sheet stays open after saving, marking the directory behind it aria-hidden.
  expect(
    screen.getByRole('button', {
      name: `${target.registration}, Bêta Logistique`,
      hidden: true,
    }),
  ).toBeInTheDocument()
})

test('shows a distinct error when a provider change is locked by a discharge commitment', async () => {
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })
  server.use(
    http.patch(`${API_BASE_URL}/api/v1/trucks/${target.id}`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_TRUCK_TRANSPORT_COMPANY_LOCKED',
            message:
              'Truck transport company cannot change while the truck is assigned to a planned or active discharge',
          },
        },
        { status: 409 },
      ),
    ),
  )

  renderTrucks()
  await openTruckDetails(target.registration, 'Atlantic Transport')
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  fireEvent.click(await screen.findByRole('combobox', { name: 'Transport company' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Bêta Logistique' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(
    await screen.findByText(`Unable to update truck “${target.registration}”`),
  ).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Edit truck' })).toBeInTheDocument()
})

test('shows a distinct error when the submitted transport company is invalid', async () => {
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })
  server.use(
    http.patch(`${API_BASE_URL}/api/v1/trucks/${target.id}`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_TRUCK_TRANSPORT_COMPANY_INVALID',
            message: 'Transport company must exist and be available',
          },
        },
        { status: 422 },
      ),
    ),
  )

  renderTrucks()
  await openTruckDetails(target.registration, 'Atlantic Transport')
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  fireEvent.click(await screen.findByRole('combobox', { name: 'Transport company' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Bêta Logistique' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(
    await screen.findByText(`Unable to update truck “${target.registration}”`),
  ).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Edit truck' })).toBeInTheDocument()
})
