import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import type { TransportCompanyDto } from '@/features/transport-companies/types'
import type { TruckDto } from '@/features/trucks/types'
import { server } from '@/test/msw/server'
import {
  EF_789_GH,
  FLEET_COMPANIES,
  FLEET_TRUCKS,
  GH_012_JK,
  LM_678_NP,
  LOIRE_ID,
  MORVAN_ID,
  QR_234_ST,
} from './support/fleet-fixtures'
import {
  API_BASE_URL,
  expectListed,
  findFleetTable,
  fleetPath,
  groupHeader,
  mockFleet,
  renderFleet,
  statusPill,
  truckRow,
} from './support/fleet-test-helpers'

/** Each journey opens a menu and a confirmation, then waits for the refetch it causes. */
const JOURNEY = { timeout: 15000 }

const OPERATIONS_ADMIN = { id: 'operations-admin-1', firstName: 'Olivia', lastName: 'Observer' }
const NOW = '2026-09-24T09:00:00.000Z'

type Fleet = ReturnType<typeof mockFleet>

/** Answers a truck lifecycle request the way the API does, and updates what later reads return. */
function answerTruck(
  fleet: Fleet,
  path: string,
  patch: (truck: TruckDto, comment: string | null) => Partial<TruckDto>,
  received: Array<{ id: string; comment: string | null }> = [],
) {
  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks/:id/${path}`, async ({ params, request }) => {
      const { comment } = (await request.json()) as { comment: string | null }
      const id = String(params.id)
      const current = fleet.trucks.find((truck) => truck.id === id) as TruckDto
      const updated = { ...current, ...patch(current, comment), updatedAt: NOW }

      received.push({ id, comment })
      fleet.trucks = fleet.trucks.map((truck) => (truck.id === id ? updated : truck))
      return HttpResponse.json({ data: updated })
    }),
  )

  return received
}

function answerCompany(
  fleet: Fleet,
  path: string,
  patch: (company: TransportCompanyDto) => Partial<TransportCompanyDto>,
) {
  server.use(
    http.post(`${API_BASE_URL}/api/v1/transport-companies/:id/${path}`, ({ params }) => {
      const id = String(params.id)
      const current = fleet.companies.find((company) => company.id === id) as TransportCompanyDto
      const updated = { ...current, ...patch(current), updatedAt: NOW }

      fleet.companies = fleet.companies.map((company) => (company.id === id ? updated : company))
      return HttpResponse.json({ data: updated })
    }),
  )
}

async function openMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: `Actions for ${name}` }))

  return screen.findByRole('menu')
}

function menuItems(menu: HTMLElement) {
  return within(menu)
    .getAllByRole('menuitem')
    .map((item) => item.textContent?.trim())
}

test('offers each truck the actions its status allows', JOURNEY, async () => {
  const user = userEvent.setup()
  mockFleet()
  renderFleet(fleetPath({ status: ['available', 'suspended', 'archived'] }))
  await findFleetTable()

  expect(menuItems(await openMenu(user, EF_789_GH.registration))).toEqual([
    'View',
    'Edit',
    'Suspend',
    'Archive',
  ])
  await user.keyboard('{Escape}')

  expect(menuItems(await openMenu(user, GH_012_JK.registration))).toEqual([
    'View',
    'Return to service',
  ])
  await user.keyboard('{Escape}')

  expect(menuItems(await openMenu(user, QR_234_ST.registration))).toEqual(['View', 'Reactivate'])
})

test('suspends a truck and confirms it stays in its current discharges', JOURNEY, async () => {
  const user = userEvent.setup()
  const fleet = mockFleet()
  const received = answerTruck(fleet, 'suspend', (_truck, comment) => ({
    status: 'SUSPENDED',
    suspendedAt: NOW,
    suspendedByUserId: OPERATIONS_ADMIN.id,
    suspendedBy: OPERATIONS_ADMIN,
    suspensionComment: comment,
  }))
  renderFleet()
  await findFleetTable()

  const menu = await openMenu(user, EF_789_GH.registration)
  await user.click(within(menu).getByRole('menuitem', { name: 'Suspend' }))

  const dialog = await screen.findByRole('alertdialog', { name: 'Suspend EF-789-GH?' })
  expect(dialog).toHaveTextContent(
    'The truck is withdrawn from new discharges, shifts and rotations. Discharges it already belongs to continue unchanged. Its registration stays reserved.',
  )
  const comment = within(dialog).getByLabelText('Comment (optional)')
  expect(comment).toHaveAttribute(
    'placeholder',
    'Why is this truck suspended? (breakdown, maintenance…)',
  )
  await user.type(comment, 'Brake inspection after a warning light')
  await user.click(within(dialog).getByRole('button', { name: 'Suspend' }))

  expect(await screen.findByText('Truck “EF-789-GH” suspended')).toBeInTheDocument()
  expect(screen.getByText('It stays in its current discharges.')).toBeInTheDocument()
  expect(received).toEqual([
    { id: EF_789_GH.id, comment: 'Brake inspection after a warning light' },
  ])
  await waitFor(() =>
    expect(within(truckRow(EF_789_GH.registration)).getByText('Suspended')).toBeInTheDocument(),
  )
  expect(
    within(truckRow(EF_789_GH.registration)).getByText('Olivia Observer, 24/09/2026', {
      exact: false,
    }),
  ).toBeInTheDocument()
  expect(
    within(groupHeader('Loire Logistique')).getByText('0 available ·', { exact: false }),
  ).toHaveTextContent('0 available · 2 suspended')
  expect(statusPill('Available')).toHaveTextContent('4')
  expect(statusPill('Suspended')).toHaveTextContent('3')
})

test('returns a suspended truck to service from its row', JOURNEY, async () => {
  const user = userEvent.setup()
  const fleet = mockFleet()
  const received = answerTruck(fleet, 'return-to-service', (_truck, comment) => ({
    status: 'AVAILABLE',
    returnedToServiceAt: NOW,
    returnedToServiceByUserId: OPERATIONS_ADMIN.id,
    returnedToServiceBy: OPERATIONS_ADMIN,
    returnToServiceComment: comment,
  }))
  renderFleet()
  await findFleetTable()

  await user.click(screen.getByRole('button', { name: 'Return GH-012-JK to service' }))

  const dialog = await screen.findByRole('alertdialog', { name: 'Return GH-012-JK to service?' })
  expect(dialog).toHaveTextContent(
    'It becomes available again for new discharges, shift assignments and rotations. The suspension stays in its history.',
  )
  const comment = within(dialog).getByLabelText('Comment (optional)')
  expect(comment).toHaveAttribute('placeholder', 'What was done? (optional)')
  await user.type(comment, 'Brakes checked and approved')
  await user.click(within(dialog).getByRole('button', { name: 'Return to service' }))

  expect(await screen.findByText('Truck “GH-012-JK” returned to service')).toBeInTheDocument()
  expect(received).toEqual([{ id: GH_012_JK.id, comment: 'Brakes checked and approved' }])
  await waitFor(() =>
    expect(within(truckRow(GH_012_JK.registration)).getByText('Available')).toBeInTheDocument(),
  )
  expect(
    screen.queryByRole('button', { name: 'Return GH-012-JK to service' }),
  ).not.toBeInTheDocument()
})

test('archives an available truck after confirmation', JOURNEY, async () => {
  const user = userEvent.setup()
  const fleet = mockFleet()
  const received = answerTruck(fleet, 'archive', (_truck, comment) => ({
    status: 'ARCHIVED',
    archivedAt: NOW,
    archivedByUserId: OPERATIONS_ADMIN.id,
    archivedBy: OPERATIONS_ADMIN,
    archiveComment: comment,
  }))
  renderFleet()
  await findFleetTable()

  const menu = await openMenu(user, LM_678_NP.registration)
  await user.click(within(menu).getByRole('menuitem', { name: 'Archive' }))

  const dialog = await screen.findByRole('alertdialog', { name: 'Archive LM-678-NP?' })
  expect(dialog).toHaveTextContent(
    'The truck leaves the fleet for new discharges, shifts and rotations. Past discharges keep it and its registration stays reserved. You can reactivate it later.',
  )
  expect(within(dialog).getByLabelText('Comment (optional)')).toHaveAttribute(
    'placeholder',
    'Why is this truck archived?',
  )
  await user.type(within(dialog).getByLabelText('Comment (optional)'), 'Sold to another operator')
  await user.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText('Truck “LM-678-NP” archived')).toBeInTheDocument()
  expect(received).toEqual([{ id: LM_678_NP.id, comment: 'Sold to another operator' }])
  await expectListed(['AB-123-CD', 'CD-456-EF', 'NP-901-QR', 'JK-345-LM', 'EF-789-GH', 'GH-012-JK'])
})

test('keeps the dialog open and refreshes the fleet when the API refuses', JOURNEY, async () => {
  const user = userEvent.setup()
  let truckReads = 0
  mockFleet({
    onCompleteTrucksRequest: () => {
      truckReads += 1
    },
  })
  server.use(
    http.post(`${API_BASE_URL}/api/v1/trucks/:id/archive`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_TRUCK_IN_USE',
            message: 'Truck is used by a planned or active discharge',
          },
        },
        { status: 409 },
      ),
    ),
  )
  renderFleet()
  await findFleetTable()
  const readsBefore = truckReads

  const menu = await openMenu(user, EF_789_GH.registration)
  await user.click(within(menu).getByRole('menuitem', { name: 'Archive' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Archive EF-789-GH?' })
  await user.type(within(dialog).getByLabelText('Comment (optional)'), 'Retired')
  await user.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText('Unable to archive truck “EF-789-GH”')).toBeInTheDocument()
  expect(screen.getByText('Truck is used by a planned or active discharge')).toBeInTheDocument()
  expect(within(dialog).getByLabelText('Comment (optional)')).toHaveValue('Retired')
  await waitFor(() => expect(truckReads).toBeGreaterThan(readsBefore))
})

test(
  'reactivates an archived truck only once its company is available again',
  JOURNEY,
  async () => {
    const user = userEvent.setup()
    const fleet = mockFleet()
    answerCompany(fleet, 'reactivate', () => ({
      status: 'AVAILABLE',
      reactivatedAt: NOW,
      reactivatedByUserId: OPERATIONS_ADMIN.id,
      reactivatedBy: OPERATIONS_ADMIN,
    }))
    const received = answerTruck(fleet, 'reactivate', () => ({
      status: 'AVAILABLE',
      reactivatedAt: NOW,
    }))
    renderFleet(fleetPath({ status: ['archived'] }))
    await findFleetTable()

    expect(screen.getByRole('button', { name: 'Reactivate QR-234-ST' })).toBeDisabled()

    await user.click(
      within(groupHeader('Transports Morvan')).getByRole('button', { name: 'Reactivate' }),
    )
    const companyDialog = await screen.findByRole('alertdialog')
    await user.click(within(companyDialog).getByRole('button', { name: 'Reactivate' }))
    expect(
      await screen.findByText('Transport company “Transports Morvan” reactivated'),
    ).toBeInTheDocument()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Reactivate QR-234-ST' })).toBeEnabled(),
    )
    await user.click(screen.getByRole('button', { name: 'Reactivate QR-234-ST' }))
    const truckDialog = await screen.findByRole('alertdialog')
    await user.click(within(truckDialog).getByRole('button', { name: 'Reactivate' }))

    expect(await screen.findByText('Truck “QR-234-ST” reactivated')).toBeInTheDocument()
    expect(received.map(({ id }) => id)).toEqual([QR_234_ST.id])
  },
)

test(
  'offers each company its actions and explains why it cannot be archived yet',
  JOURNEY,
  async () => {
    const user = userEvent.setup()
    mockFleet()
    renderFleet()
    await findFleetTable()

    const menu = await openMenu(user, 'Loire Logistique')

    expect(menuItems(menu)).toEqual([
      'View details',
      'Edit',
      'Add truck',
      'ArchiveStill provides 1 available truck',
    ])
    expect(within(menu).getByRole('menuitem', { name: /Archive/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  },
)

test('archives a company that provides no available truck', JOURNEY, async () => {
  const user = userEvent.setup()
  const loireSuspendedOnly = FLEET_TRUCKS.filter((truck) => truck.id !== EF_789_GH.id)
  const fleet = mockFleet({ companies: FLEET_COMPANIES, trucks: loireSuspendedOnly })
  answerCompany(fleet, 'archive', () => ({
    status: 'ARCHIVED',
    archivedAt: NOW,
    archivedByUserId: OPERATIONS_ADMIN.id,
    archivedBy: OPERATIONS_ADMIN,
  }))
  renderFleet()
  await findFleetTable()

  const menu = await openMenu(user, 'Loire Logistique')
  await user.click(within(menu).getByRole('menuitem', { name: 'Archive' }))
  const dialog = await screen.findByRole('alertdialog')
  await user.click(within(dialog).getByRole('button', { name: 'Archive' }))

  expect(
    await screen.findByText('Transport company “Loire Logistique” archived'),
  ).toBeInTheDocument()
  expect(fleet.companies.find((company) => company.id === LOIRE_ID)?.status).toBe('ARCHIVED')
  expect(fleet.companies.find((company) => company.id === MORVAN_ID)?.status).toBe('ARCHIVED')
})
