import { fireEvent, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import type { TruckDto } from '@/features/trucks/types'
import { server } from '@/test/msw/server'
import {
  ACTIVE_OPERATIONS_ADMIN,
  API_BASE_URL,
  AVAILABLE_TRUCKS,
  TRUCKS,
} from '../support/fixtures'
import { mockTrucks, renderTrucks } from '../support/test-helpers'

test('creates a truck and shows it in the workspace without a manual refresh', async () => {
  const created: TruckDto = {
    ...TRUCKS[0],
    id: 'created-1',
    registration: 'NEW-001',
    vehicleModel: null,
  }
  let currentComplete = TRUCKS
  let currentAvailable = AVAILABLE_TRUCKS

  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })
  server.use(
    http.get(`${API_BASE_URL}/api/v1/trucks`, () => HttpResponse.json({ data: currentComplete })),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () =>
      HttpResponse.json({ data: currentAvailable }),
    ),
    http.post(`${API_BASE_URL}/api/v1/trucks`, () => {
      currentComplete = [...currentComplete, created]
      currentAvailable = [...currentAvailable, created]
      return HttpResponse.json({ data: created }, { status: 201 })
    }),
  )

  renderTrucks()
  await screen.findByRole('button', { name: 'Create truck' })
  fireEvent.click(screen.getByRole('button', { name: 'Create truck' }))

  fireEvent.change(await screen.findByRole('textbox', { name: 'Registration' }), {
    target: { value: created.registration },
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'Capacity (tonnes)' }), {
    target: { value: '12.5' },
  })
  fireEvent.click(screen.getByRole('combobox', { name: 'Transport company' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Atlantic Transport' }))
  fireEvent.click(screen.getByRole('button', { name: 'Create truck' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await screen.findByRole('heading', { name: created.registration })).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: `${created.registration}, Atlantic Transport` }),
  ).toBeInTheDocument()
})

test('offers only available transport companies in the picker', async () => {
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  renderTrucks()
  fireEvent.click(await screen.findByRole('button', { name: 'Create truck' }))
  fireEvent.click(await screen.findByRole('combobox', { name: 'Transport company' }))

  expect(await screen.findByRole('option', { name: 'Atlantic Transport' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Bêta Logistique' })).toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Coastal Haulage' })).not.toBeInTheDocument()
})

test('shows the selected transport company name rather than its id', async () => {
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  renderTrucks()
  fireEvent.click(await screen.findByRole('button', { name: 'Create truck' }))
  const combobox = await screen.findByRole('combobox', { name: 'Transport company' })
  fireEvent.click(combobox)
  fireEvent.click(await screen.findByRole('option', { name: 'Atlantic Transport' }))

  expect(combobox).toHaveTextContent('Atlantic Transport')
  expect(combobox).not.toHaveTextContent(/^[0-9a-f-]{36}$/)
})

test('clears the transport-company error once a company is selected after a failed submit', async () => {
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  renderTrucks()
  fireEvent.click(await screen.findByRole('button', { name: 'Create truck' }))
  fireEvent.change(await screen.findByRole('textbox', { name: 'Registration' }), {
    target: { value: 'NO-COMPANY-01' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'Capacity (tonnes)' }), {
    target: { value: '10' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create truck' }))

  expect(await screen.findByText('Select a transport company.')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('combobox', { name: 'Transport company' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Atlantic Transport' }))

  await waitFor(() =>
    expect(screen.queryByText('Select a transport company.')).not.toBeInTheDocument(),
  )
})

test('rejects a blank registration and a non-positive capacity without submitting', async () => {
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })

  renderTrucks()
  fireEvent.click(await screen.findByRole('button', { name: 'Create truck' }))

  const registration = await screen.findByRole('textbox', { name: 'Registration' })
  fireEvent.change(registration, { target: { value: '   ' } })
  fireEvent.blur(registration)
  const capacity = screen.getByRole('textbox', { name: 'Capacity (tonnes)' })
  fireEvent.change(capacity, { target: { value: '0' } })
  fireEvent.blur(capacity)

  expect(await screen.findByText('Registration is required.')).toBeInTheDocument()
  expect(screen.getByText('Capacity must be a positive number of tonnes.')).toBeInTheDocument()
})

test('surfaces a duplicate-registration conflict from the API without closing the panel', async () => {
  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })
  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_TRUCK_REGISTRATION_CONFLICT',
            message: 'Truck registration is already in use',
          },
        },
        { status: 409 },
      ),
    ),
  )

  renderTrucks()
  fireEvent.click(await screen.findByRole('button', { name: 'Create truck' }))
  fireEvent.change(await screen.findByRole('textbox', { name: 'Registration' }), {
    target: { value: 'AA-101-PF' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'Capacity (tonnes)' }), {
    target: { value: '10' },
  })
  fireEvent.click(screen.getByRole('combobox', { name: 'Transport company' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Atlantic Transport' }))
  const submitButton = screen.getByRole('button', { name: 'Create truck' })
  fireEvent.click(submitButton)

  await waitFor(() => expect(submitButton).not.toBeDisabled())
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'AA-101-PF, Atlantic Transport' }),
  ).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

test('creates the truck once a duplicate-conflict registration is corrected and resubmitted', async () => {
  const created: TruckDto = { ...TRUCKS[0], id: 'created-2', registration: 'FIXED-001' }
  let attempts = 0
  let currentComplete = TRUCKS
  let currentAvailable = AVAILABLE_TRUCKS

  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })
  server.use(
    http.get(`${API_BASE_URL}/api/v1/trucks`, () => HttpResponse.json({ data: currentComplete })),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () =>
      HttpResponse.json({ data: currentAvailable }),
    ),
    http.post(`${API_BASE_URL}/api/v1/trucks`, () => {
      attempts += 1
      if (attempts === 1) {
        return HttpResponse.json(
          {
            error: {
              code: 'E_TRUCK_REGISTRATION_CONFLICT',
              message: 'Truck registration is already in use',
            },
          },
          { status: 409 },
        )
      }
      currentComplete = [...currentComplete, created]
      currentAvailable = [...currentAvailable, created]
      return HttpResponse.json({ data: created }, { status: 201 })
    }),
  )

  renderTrucks()
  fireEvent.click(await screen.findByRole('button', { name: 'Create truck' }))
  const registration = await screen.findByRole('textbox', { name: 'Registration' })
  fireEvent.change(registration, { target: { value: 'AA-101-PF' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Capacity (tonnes)' }), {
    target: { value: '10' },
  })
  fireEvent.click(screen.getByRole('combobox', { name: 'Transport company' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Atlantic Transport' }))
  const submitButton = screen.getByRole('button', { name: 'Create truck' })
  fireEvent.click(submitButton)
  await waitFor(() => expect(submitButton).not.toBeDisabled())
  expect(screen.getByRole('dialog')).toBeInTheDocument()

  fireEvent.change(registration, { target: { value: created.registration } })
  fireEvent.click(submitButton)

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), {
    timeout: 10000,
  })
  expect(
    await screen.findByRole('heading', { name: created.registration }, { timeout: 10000 }),
  ).toBeInTheDocument()
  expect(attempts).toBe(2)
}, 15000)

test('retries after a transient failure and creates exactly one truck', async () => {
  const created: TruckDto = { ...TRUCKS[0], id: 'created-3', registration: 'RETRY-001' }
  let attempts = 0
  let currentComplete = TRUCKS
  let currentAvailable = AVAILABLE_TRUCKS

  mockTrucks({ user: ACTIVE_OPERATIONS_ADMIN })
  server.use(
    http.get(`${API_BASE_URL}/api/v1/trucks`, () => HttpResponse.json({ data: currentComplete })),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () =>
      HttpResponse.json({ data: currentAvailable }),
    ),
    http.post(`${API_BASE_URL}/api/v1/trucks`, () => {
      attempts += 1
      if (attempts === 1) {
        return HttpResponse.json(
          { error: { code: 'E_INTERNAL_SERVER_ERROR', message: 'Something went wrong' } },
          { status: 500 },
        )
      }
      currentComplete = [...currentComplete, created]
      currentAvailable = [...currentAvailable, created]
      return HttpResponse.json({ data: created }, { status: 201 })
    }),
  )

  renderTrucks()
  fireEvent.click(await screen.findByRole('button', { name: 'Create truck' }))
  fireEvent.change(await screen.findByRole('textbox', { name: 'Registration' }), {
    target: { value: created.registration },
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'Capacity (tonnes)' }), {
    target: { value: '10' },
  })
  fireEvent.click(screen.getByRole('combobox', { name: 'Transport company' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Atlantic Transport' }))
  const submitButton = screen.getByRole('button', { name: 'Create truck' })
  fireEvent.click(submitButton)
  await waitFor(() => expect(submitButton).not.toBeDisabled())
  expect(screen.getByRole('dialog')).toBeInTheDocument()

  fireEvent.click(submitButton)

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), {
    timeout: 10000,
  })
  expect(
    await screen.findByRole('heading', { name: created.registration }, { timeout: 10000 }),
  ).toBeInTheDocument()
  expect(attempts).toBe(2)
}, 15000)
