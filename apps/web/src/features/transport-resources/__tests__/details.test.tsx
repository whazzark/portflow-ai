import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { ACTIVE_OPERATIONS_LEAD } from '@/features/trucks/__tests__/support/fixtures'
import { formatDateTime } from '@/helpers/dates'
import {
  EF_789_GH,
  FLEET_COMPANIES,
  GH_012_JK,
  LOIRE_ID,
  MORVAN_ID,
} from './support/fleet-fixtures'
import {
  findFleetTable,
  fleetPath,
  fleetTable,
  JOURNEY,
  mockFleet,
  renderFleet,
} from './support/fleet-test-helpers'

function truckDetail(registration: string) {
  return screen.getByRole('region', { name: `Truck ${registration}` })
}

function companyDetail(name: string) {
  return screen.getByRole('region', { name: `Transport company ${name}` })
}

function historyEntries(region: HTMLElement) {
  const history = within(region).getByRole('region', { name: 'History' })

  return within(history)
    .getAllByRole('listitem')
    .map((item) => item.textContent)
}

test('opens a truck in place with its company, dates and history', JOURNEY, async () => {
  const user = userEvent.setup()
  mockFleet()
  const { router } = renderFleet()
  await findFleetTable()

  await user.click(within(fleetTable()).getByRole('button', { name: 'View truck GH-012-JK' }))

  const detail = await screen.findByRole('region', { name: 'Truck GH-012-JK' })
  expect(within(detail).getByRole('heading', { name: 'Truck' })).toBeInTheDocument()
  expect(within(detail).getByText('Transport company')).toBeInTheDocument()
  expect(within(detail).getByText('Loire Logistique')).toBeInTheDocument()
  expect(within(detail).getByText('Company status')).toBeInTheDocument()
  expect(within(detail).getByText('Last updated').nextElementSibling).toHaveTextContent(
    formatDateTime(GH_012_JK.updatedAt),
  )
  const [latest, earlier] = historyEntries(detail)
  expect(latest).toContain('Suspended')
  expect(latest).toContain('Thomas Bernard')
  expect(latest).toContain('“Brake inspection after a warning light”')
  expect(earlier).toContain('Returned to service')
  expect(earlier).toContain('Claire Martin')
  expect(earlier).toContain('“Gearbox repaired”')
  await expect.poll(() => router.state.location.search).toMatchObject({ truckId: GH_012_JK.id })
})

test(
  'asks for a return to service before a suspended truck is edited or archived',
  JOURNEY,
  async () => {
    mockFleet()
    renderFleet(fleetPath({ truckId: GH_012_JK.id }))
    await findFleetTable()

    const detail = truckDetail(GH_012_JK.registration)
    expect(
      within(detail).getByText('Return it to service before editing or archiving it.'),
    ).toBeInTheDocument()
    expect(within(detail).getByRole('button', { name: 'Return to service' })).toBeInTheDocument()
    expect(within(detail).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(within(detail).queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument()
  },
)

test('offers an available truck its edit and lifecycle actions', JOURNEY, async () => {
  mockFleet()
  renderFleet(fleetPath({ truckId: EF_789_GH.id }))
  await findFleetTable()

  const detail = truckDetail(EF_789_GH.registration)
  expect(within(detail).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  expect(within(detail).getByRole('button', { name: 'Suspend' })).toBeInTheDocument()
  expect(within(detail).getByRole('button', { name: 'Archive' })).toBeInTheDocument()
  expect(within(detail).getByText('No lifecycle history yet.')).toBeInTheDocument()
})

test('hides the detail and returns focus to its truck', JOURNEY, async () => {
  const user = userEvent.setup()
  mockFleet()
  renderFleet(fleetPath({ truckId: GH_012_JK.id }))
  await findFleetTable()

  await user.click(screen.getByRole('button', { name: 'Hide details for GH-012-JK' }))

  await waitFor(() =>
    expect(screen.queryByRole('region', { name: 'Truck GH-012-JK' })).not.toBeInTheDocument(),
  )
  expect(within(fleetTable()).getByRole('button', { name: 'View truck GH-012-JK' })).toHaveFocus()
})

test('closes the open detail with Escape', JOURNEY, async () => {
  const user = userEvent.setup()
  mockFleet()
  renderFleet(fleetPath({ truckId: EF_789_GH.id }))
  await findFleetTable()

  await user.click(within(truckDetail(EF_789_GH.registration)).getByText('Transport company'))
  await user.keyboard('{Escape}')

  await waitFor(() =>
    expect(screen.queryByRole('region', { name: 'Truck EF-789-GH' })).not.toBeInTheDocument(),
  )
})

test('drops an unknown truck from the address', JOURNEY, async () => {
  mockFleet()
  const { router } = renderFleet(fleetPath({ truckId: 'missing-truck' }))
  await findFleetTable()

  await expect.poll(() => router.state.location.search).not.toHaveProperty('truckId')
})

test('shows a non-administrator the history without who acted', JOURNEY, async () => {
  mockFleet({ user: ACTIVE_OPERATIONS_LEAD })
  renderFleet(fleetPath({ truckId: GH_012_JK.id }))
  await findFleetTable()

  const detail = truckDetail(GH_012_JK.registration)
  const [latest] = historyEntries(detail)
  expect(latest).toContain('Suspended')
  expect(latest).not.toContain('Thomas Bernard')
  expect(within(detail).queryByRole('button', { name: 'Return to service' })).toBeNull()
})

test('opens a company in place and explains when it can be archived', JOURNEY, async () => {
  const user = userEvent.setup()
  mockFleet()
  const { router } = renderFleet()
  await findFleetTable()

  await user.click(screen.getByRole('button', { name: 'Actions for Loire Logistique' }))
  await user.click(await screen.findByRole('menuitem', { name: 'View details' }))

  const detail = await screen.findByRole('region', { name: 'Transport company Loire Logistique' })
  expect(within(detail).getByText('+33 2 41 88 03 17')).toBeInTheDocument()
  expect(within(detail).getByText('exploitation@loire-logistique.example')).toBeInTheDocument()
  expect(
    within(detail).getByText(
      formatDateTime(FLEET_COMPANIES.find((company) => company.id === LOIRE_ID)?.createdAt ?? null),
    ),
  ).toBeInTheDocument()
  expect(within(detail).getByText('Never archived.')).toBeInTheDocument()
  expect(
    within(detail).getByText('Can be archived once it provides no available truck (1 today).'),
  ).toBeInTheDocument()
  expect(within(detail).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  expect(within(detail).getByRole('button', { name: 'Archive' })).toBeDisabled()
  await expect
    .poll(() => router.state.location.search)
    .toMatchObject({ companyDetailsId: LOIRE_ID })
})

test('shows an archived company its archive context and reactivation', JOURNEY, async () => {
  mockFleet()
  renderFleet(fleetPath({ status: ['archived'], companyDetailsId: MORVAN_ID }))
  await findFleetTable()

  const detail = companyDetail('Transports Morvan')
  expect(within(detail).getByText('“Company closed its bulk activity”')).toBeInTheDocument()
  expect(within(detail).getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
  expect(within(detail).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
})
