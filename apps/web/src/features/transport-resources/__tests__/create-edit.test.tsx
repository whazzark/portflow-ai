import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import type { TransportCompanyDto } from '@/features/transport-companies/types'
import type { TruckDto } from '@/features/trucks/types'
import { server } from '@/test/msw/server'
import { BRETAGNE_ID, EF_789_GH, FLEET_COMPANIES, LOIRE_ID } from './support/fleet-fixtures'
import {
  API_BASE_URL,
  expectListed,
  findFleetTable,
  fleetPath,
  groupHeader,
  JOURNEY,
  mockFleet,
  renderFleet,
  truckRow,
} from './support/fleet-test-helpers'

const NOW = '2026-09-24T09:00:00.000Z'

type Fleet = ReturnType<typeof mockFleet>

function form(name: string) {
  return screen.getByRole('form', { name })
}

function answerTruckCreation(fleet: Fleet, received: unknown[] = []) {
  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks`, async ({ request }) => {
      const body = (await request.json()) as Pick<
        TruckDto,
        'registration' | 'vehicleModel' | 'capacityTonnes' | 'transportCompanyId'
      >
      received.push(body)
      const created: TruckDto = {
        ...EF_789_GH,
        ...body,
        id: '00000000-0000-4000-8000-000000000c01',
        createdAt: NOW,
        updatedAt: NOW,
      }
      fleet.trucks = [...fleet.trucks, created]
      return HttpResponse.json({ data: created }, { status: 201 })
    }),
  )

  return received
}

test('offers to create a truck or a transport company', JOURNEY, async () => {
  const user = userEvent.setup()
  mockFleet()
  renderFleet()
  await findFleetTable()

  await user.click(screen.getByRole('button', { name: 'Create' }))
  const menu = await screen.findByRole('menu')

  expect(
    within(menu)
      .getAllByRole('menuitem')
      .map((item) => item.textContent),
  ).toEqual(['Truck', 'Transport company'])
})

test('creates a transport company inline and shows it as an empty group', JOURNEY, async () => {
  const user = userEvent.setup()
  const fleet = mockFleet()
  let received: unknown = null
  server.use(
    http.post(`${API_BASE_URL}/api/v1/transport-companies`, async ({ request }) => {
      received = await request.json()
      const created: TransportCompanyDto = {
        ...(fleet.companies[0] as TransportCompanyDto),
        ...(received as Pick<TransportCompanyDto, 'name' | 'contactPhone' | 'contactEmail'>),
        id: '00000000-0000-4000-8000-000000000a09',
        createdAt: NOW,
        updatedAt: NOW,
      }
      fleet.companies = [...fleet.companies, created]
      return HttpResponse.json({ data: created }, { status: 201 })
    }),
  )
  renderFleet()
  await findFleetTable()

  await user.click(screen.getByRole('button', { name: 'Create' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Transport company' }))

  const row = await screen.findByRole('form', { name: 'Create transport company' })
  await user.click(within(row).getByRole('button', { name: 'Create' }))
  expect(await within(row).findByText('Company name is required.')).toBeInTheDocument()

  await user.type(within(row).getByLabelText(/Company name/), 'Vendée Bennes')
  await user.type(within(row).getByLabelText(/Contact phone/), '+33 2 51 00 00 00')
  await user.type(within(row).getByLabelText(/Contact email/), 'planning@vendee-bennes.example')
  await user.click(within(row).getByRole('button', { name: 'Create' }))

  expect(await screen.findByText('Transport company “Vendée Bennes” created')).toBeInTheDocument()
  expect(received).toEqual({
    name: 'Vendée Bennes',
    contactPhone: '+33 2 51 00 00 00',
    contactEmail: 'planning@vendee-bennes.example',
  })
  await waitFor(() => expect(groupHeader('Vendée Bennes')).toBeInTheDocument())
  expect(within(groupHeader('Vendée Bennes')).getByText('0 available')).toBeInTheDocument()
})

test('keeps the typed company when its name is already taken', JOURNEY, async () => {
  const user = userEvent.setup()
  mockFleet()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/transport-companies`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_TRANSPORT_COMPANY_NAME_CONFLICT',
            message: 'A transport company with this name already exists',
          },
        },
        { status: 409 },
      ),
    ),
  )
  renderFleet(fleetPath({ companyDetailsMode: 'create' }))
  await findFleetTable()

  const row = form('Create transport company')
  await user.type(within(row).getByLabelText(/Company name/), 'Bretagne Vrac')
  await user.type(within(row).getByLabelText(/Contact phone/), '+33 2 97 45 10 22')
  await user.type(within(row).getByLabelText(/Contact email/), 'planning@bretagne-vrac.example')
  await user.click(within(row).getByRole('button', { name: 'Create' }))

  const name = within(row).getByLabelText(/Company name/)
  await waitFor(() => expect(name).toHaveAttribute('aria-invalid', 'true'))
  expect(
    within(row).getByText('A transport company with this name already exists'),
  ).toBeInTheDocument()
  expect(name).toHaveValue('Bretagne Vrac')
})

test('adds a truck to a company from its menu', JOURNEY, async () => {
  const user = userEvent.setup()
  const fleet = mockFleet()
  const received = answerTruckCreation(fleet)
  renderFleet()
  await findFleetTable()

  await user.click(screen.getByRole('button', { name: 'Actions for Loire Logistique' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Add truck' }))

  const row = await screen.findByRole('form', { name: 'Create truck' })
  expect(within(row).getByText('Added to Loire Logistique')).toBeInTheDocument()
  expect(within(row).getByText('Available')).toBeInTheDocument()
  expect(within(row).queryByRole('combobox')).not.toBeInTheDocument()

  await user.type(within(row).getByLabelText(/Registration/), 'RS-567-TU')
  await user.type(within(row).getByLabelText(/Vehicle model/), 'Volvo FMX')
  await user.type(within(row).getByLabelText(/Capacity/), '32,5')
  await user.click(within(row).getByRole('button', { name: 'Save' }))
  expect(
    await within(row).findByText('Capacity must be a positive number of tonnes.'),
  ).toBeInTheDocument()

  await user.clear(within(row).getByLabelText(/Capacity/))
  await user.type(within(row).getByLabelText(/Capacity/), '32.5')
  await user.click(within(row).getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Truck “RS-567-TU” created')).toBeInTheDocument()
  expect(received).toEqual([
    {
      registration: 'RS-567-TU',
      vehicleModel: 'Volvo FMX',
      capacityTonnes: 32.5,
      transportCompanyId: LOIRE_ID,
    },
  ])
  await expectListed([
    'AB-123-CD',
    'CD-456-EF',
    'NP-901-QR',
    'JK-345-LM',
    'LM-678-NP',
    'EF-789-GH',
    'GH-012-JK',
    'RS-567-TU',
  ])
})

test('shows a taken registration on its field and keeps the row', JOURNEY, async () => {
  const user = userEvent.setup()
  mockFleet()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_TRUCK_REGISTRATION_CONFLICT',
            message: 'A truck with this registration already exists',
          },
        },
        { status: 409 },
      ),
    ),
  )
  renderFleet(fleetPath({ truckMode: 'create', truckCompanyId: BRETAGNE_ID }))
  await findFleetTable()

  const row = form('Create truck')
  await user.type(within(row).getByLabelText(/Registration/), 'EF-789-GH')
  await user.type(within(row).getByLabelText(/Capacity/), '29')
  await user.click(within(row).getByRole('button', { name: 'Save' }))

  const registration = within(row).getByLabelText(/Registration/)
  await waitFor(() => expect(registration).toHaveAttribute('aria-invalid', 'true'))
  expect(within(row).getByText('A truck with this registration already exists')).toBeInTheDocument()
  expect(registration).toHaveValue('EF-789-GH')
})

test('asks for the company of a truck created from the toolbar', JOURNEY, async () => {
  const user = userEvent.setup()
  mockFleet()
  renderFleet()
  await findFleetTable()

  await user.click(screen.getByRole('button', { name: 'Create' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Truck' }))

  const row = await screen.findByRole('form', { name: 'Create truck' })
  await user.click(within(row).getByRole('combobox', { name: /Transport company/ }))
  const options = (await screen.findAllByRole('option')).map((option) => option.textContent)
  // Only available companies receive new trucks.
  expect(options).toEqual(['Atlantic Transport', 'Bretagne Vrac', 'Loire Logistique'])
})

test('edits a truck inline and leaves it with Escape', JOURNEY, async () => {
  const user = userEvent.setup()
  const fleet = mockFleet()
  let received: unknown = null
  server.use(
    http.patch(`${API_BASE_URL}/api/v1/trucks/:id`, async ({ request }) => {
      received = await request.json()
      const updated = { ...EF_789_GH, ...(received as object), updatedAt: NOW }
      fleet.trucks = fleet.trucks.map((truck) => (truck.id === EF_789_GH.id ? updated : truck))
      return HttpResponse.json({ data: updated })
    }),
  )
  renderFleet()
  await findFleetTable()

  await user.click(screen.getByRole('button', { name: 'Actions for EF-789-GH' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))

  let row = await screen.findByRole('form', { name: 'Edit EF-789-GH' })
  expect(within(row).getByLabelText(/Registration/)).toHaveValue('EF-789-GH')
  expect(within(row).getByLabelText(/Vehicle model/)).toHaveValue('Renault T 480')

  await user.type(within(row).getByLabelText(/Vehicle model/), ' Evolution')
  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.queryByRole('form', { name: 'Edit EF-789-GH' })).not.toBeInTheDocument(),
  )
  expect(within(truckRow('EF-789-GH')).getByText('Renault T 480')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Actions for EF-789-GH' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
  row = await screen.findByRole('form', { name: 'Edit EF-789-GH' })
  await user.type(within(row).getByLabelText(/Vehicle model/), ' Evolution')
  await user.click(within(row).getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Truck “EF-789-GH” updated')).toBeInTheDocument()
  expect(received).toMatchObject({ vehicleModel: 'Renault T 480 Evolution' })
  await waitFor(() =>
    expect(within(truckRow('EF-789-GH')).getByText('Renault T 480 Evolution')).toBeInTheDocument(),
  )
})

test('explains on the company field why a truck cannot change company', JOURNEY, async () => {
  const user = userEvent.setup()
  mockFleet()
  server.use(
    http.patch(`${API_BASE_URL}/api/v1/trucks/:id`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_TRUCK_TRANSPORT_COMPANY_LOCKED',
            message: 'The truck is used by a planned or active discharge',
          },
        },
        { status: 409 },
      ),
    ),
  )
  renderFleet(fleetPath({ truckId: EF_789_GH.id, truckMode: 'edit' }))
  await findFleetTable()

  const row = form('Edit EF-789-GH')
  await user.click(within(row).getByRole('combobox', { name: /Transport company/ }))
  await user.click(await screen.findByRole('option', { name: 'Bretagne Vrac' }))
  await user.click(within(row).getByRole('button', { name: 'Save' }))

  expect(
    await within(row).findByText(
      'The company cannot change while this truck is used by a planned or active discharge.',
    ),
  ).toBeInTheDocument()
  expect(within(row).getByLabelText(/Registration/)).toHaveValue('EF-789-GH')
})

test('opens one form at a time', JOURNEY, async () => {
  mockFleet()
  renderFleet(fleetPath({ truckMode: 'create', truckCompanyId: LOIRE_ID }))
  await findFleetTable()

  expect(form('Create truck')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Actions for EF-789-GH' })).toBeDisabled()
})

test('edits a company inline', JOURNEY, async () => {
  const user = userEvent.setup()
  const fleet = mockFleet()
  server.use(
    http.patch(`${API_BASE_URL}/api/v1/transport-companies/:id`, async ({ request }) => {
      const body = (await request.json()) as Partial<TransportCompanyDto>
      const current = fleet.companies.find((company) => company.id === LOIRE_ID)
      const updated = { ...(current as TransportCompanyDto), ...body, updatedAt: NOW }
      fleet.companies = fleet.companies.map((company) =>
        company.id === LOIRE_ID ? updated : company,
      )
      return HttpResponse.json({ data: updated })
    }),
  )
  renderFleet(fleetPath({ companyDetailsId: LOIRE_ID, companyDetailsMode: 'edit' }))
  await findFleetTable()

  const row = form('Edit Loire Logistique')
  const phone = within(row).getByLabelText(/Contact phone/)
  await user.clear(phone)
  await user.type(phone, '+33 2 41 00 00 00')
  await user.click(within(row).getByRole('button', { name: 'Save' }))

  expect(
    await screen.findByText('Transport company “Loire Logistique” updated'),
  ).toBeInTheDocument()
  await waitFor(() =>
    expect(
      within(groupHeader('Loire Logistique')).getByText('+33 2 41 00 00 00'),
    ).toBeInTheDocument(),
  )
})

test('creates the first transport company of an empty site', JOURNEY, async () => {
  const user = userEvent.setup()
  const fleet = mockFleet({ companies: [], trucks: [] })
  server.use(
    http.post(`${API_BASE_URL}/api/v1/transport-companies`, async ({ request }) => {
      const body = (await request.json()) as Pick<
        TransportCompanyDto,
        'name' | 'contactPhone' | 'contactEmail'
      >
      const created = {
        ...FLEET_COMPANIES[0],
        ...body,
        id: '00000000-0000-4000-8000-000000000a09',
      } as TransportCompanyDto
      fleet.companies = [created]
      return HttpResponse.json({ data: created }, { status: 201 })
    }),
  )
  renderFleet()
  await screen.findByText('No transport resources yet', undefined, { timeout: 10000 })

  await user.click(screen.getByRole('button', { name: 'Create' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Transport company' }))

  const row = await screen.findByRole('form', { name: 'Create transport company' })
  await user.type(within(row).getByLabelText(/Company name/), 'Vendée Bennes')
  await user.type(within(row).getByLabelText(/Contact phone/), '+33 2 51 00 00 00')
  await user.type(within(row).getByLabelText(/Contact email/), 'planning@vendee-bennes.example')
  await user.click(within(row).getByRole('button', { name: 'Create' }))

  await waitFor(() => expect(groupHeader('Vendée Bennes')).toBeInTheDocument())
})

test('expands a collapsed company to show the truck being added', JOURNEY, async () => {
  const user = userEvent.setup()
  mockFleet()
  renderFleet()
  await findFleetTable()

  await user.click(screen.getByRole('button', { name: 'Collapse Loire Logistique' }))
  await user.click(screen.getByRole('button', { name: 'Actions for Loire Logistique' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Add truck' }))

  expect(await screen.findByRole('form', { name: 'Create truck' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Collapse Loire Logistique' })).toBeInTheDocument()
})

test('returns to the company row, with focus, once its edit is left', JOURNEY, async () => {
  const user = userEvent.setup()
  mockFleet()
  renderFleet()
  await findFleetTable()

  await user.click(screen.getByRole('button', { name: 'Actions for Loire Logistique' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
  await screen.findByRole('form', { name: 'Edit Loire Logistique' })
  await user.keyboard('{Escape}')

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Show only Loire Logistique' })).toHaveFocus(),
  )
  expect(
    screen.queryByRole('region', { name: 'Transport company Loire Logistique' }),
  ).not.toBeInTheDocument()
})

test('returns focus to the truck once its edit is left', JOURNEY, async () => {
  const user = userEvent.setup()
  mockFleet()
  renderFleet(fleetPath({ truckId: EF_789_GH.id, truckMode: 'edit' }))
  await findFleetTable()

  await user.click(within(form('Edit EF-789-GH')).getByRole('button', { name: 'Cancel edit' }))

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'View truck EF-789-GH' })).toHaveFocus(),
  )
})

test('starts nothing else from the table while a form is open', JOURNEY, async () => {
  mockFleet()
  renderFleet(
    fleetPath({ status: ['available', 'suspended', 'archived'], companyDetailsMode: 'create' }),
  )
  await findFleetTable()

  expect(form('Create transport company')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'View truck EF-789-GH' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Return GH-012-JK to service' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Reactivate QR-234-ST' })).toBeDisabled()
})
