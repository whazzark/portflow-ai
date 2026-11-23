import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import type { TruckDto } from '@/features/trucks/types'
import { server } from '@/test/msw/server'
import { AB_123_CD, FLEET_COMPANIES, GH_012_JK, NP_901_QR } from './support/fleet-fixtures'
import {
  API_BASE_URL,
  findFleetTable,
  fleetTable,
  groupHeader,
  JOURNEY,
  listedRegistrations,
  mockFleet,
  queryTruckRow,
  renderFleet,
  statusPill,
  truckRow,
} from './support/fleet-test-helpers'

test('groups the fleet by transport company in one table', JOURNEY, async () => {
  mockFleet()
  renderFleet()

  const table = await findFleetTable()
  const headers = within(table)
    .getAllByRole('columnheader')
    .map((header) => header.textContent?.trim())

  expect(headers).toEqual([
    'Registration',
    'Vehicle model',
    'Capacity',
    'Suspension',
    'Status',
    'Actions',
  ])
  expect(listedRegistrations()).toEqual([
    'AB-123-CD',
    'CD-456-EF',
    'NP-901-QR',
    'JK-345-LM',
    'LM-678-NP',
    'EF-789-GH',
    'GH-012-JK',
  ])
  // The archived company and its archived truck are not part of the default view.
  expect(screen.queryByText('Transports Morvan')).not.toBeInTheDocument()
  expect(queryTruckRow('QR-234-ST')).not.toBeInTheDocument()
})

test('summarises each company with its truck counts and contact details', JOURNEY, async () => {
  mockFleet()
  renderFleet()
  await findFleetTable()

  const atlantic = within(groupHeader('Atlantic Transport'))
  expect(atlantic.getByText('2 available ·', { exact: false })).toHaveTextContent(
    '2 available · 1 suspended',
  )
  expect(atlantic.getByText('+33 2 40 12 34 56')).toBeInTheDocument()
  expect(atlantic.getByText('dispatch@atlantic-transport.example')).toBeInTheDocument()

  // A company with no suspended truck omits the clause rather than reading "0 suspended".
  expect(within(groupHeader('Bretagne Vrac')).getByText('2 available')).toBeInTheDocument()
})

test(
  'shows each truck with its model, capacity, suspension context and status',
  JOURNEY,
  async () => {
    mockFleet()
    renderFleet()
    await findFleetTable()

    const available = within(truckRow('AB-123-CD'))
    expect(available.getByText('Volvo FMX')).toBeInTheDocument()
    expect(available.getByText('32.5 t')).toBeInTheDocument()
    expect(available.getByText('—')).toBeInTheDocument()
    expect(available.getByText('Available')).toBeInTheDocument()

    const suspended = within(truckRow(GH_012_JK.registration))
    expect(suspended.getByText('Brake inspection after a warning light')).toBeInTheDocument()
    expect(suspended.getByText('Thomas Bernard, 22/09/2026', { exact: false })).toBeInTheDocument()
    expect(suspended.getByText('Suspended')).toBeInTheDocument()
  },
)

test(
  'selects available and suspended trucks by default and counts every status',
  JOURNEY,
  async () => {
    mockFleet()
    renderFleet()
    await findFleetTable()

    expect(statusPill('Available')).toHaveAttribute('aria-pressed', 'true')
    expect(statusPill('Available')).toHaveTextContent('5')
    expect(statusPill('Suspended')).toHaveAttribute('aria-pressed', 'true')
    expect(statusPill('Suspended')).toHaveTextContent('2')
    expect(statusPill('Archived')).toHaveAttribute('aria-pressed', 'false')
    expect(statusPill('Archived')).toHaveTextContent('1')
  },
)

test('collapses and expands a company group', JOURNEY, async () => {
  const user = userEvent.setup()
  mockFleet()
  renderFleet()
  await findFleetTable()

  const collapse = within(fleetTable()).getByRole('button', { name: 'Collapse Atlantic Transport' })
  expect(collapse).toHaveAttribute('aria-expanded', 'true')

  await user.click(collapse)

  const expand = within(fleetTable()).getByRole('button', { name: 'Expand Atlantic Transport' })
  expect(expand).toHaveAttribute('aria-expanded', 'false')
  expect(queryTruckRow(NP_901_QR.registration)).not.toBeInTheDocument()
  expect(truckRow('JK-345-LM')).toBeInTheDocument()

  await user.click(expand)
  expect(truckRow(NP_901_QR.registration)).toBeInTheDocument()
})

test('sorts trucks within each group and keeps the sort in the address', JOURNEY, async () => {
  const user = userEvent.setup()
  mockFleet()
  const { router } = renderFleet()
  await findFleetTable()

  const registration = within(fleetTable()).getByRole('columnheader', { name: /Registration/ })
  expect(registration).toHaveAttribute('aria-sort', 'ascending')

  await user.click(within(fleetTable()).getByRole('button', { name: /Capacity/ }))

  await waitFor(() =>
    expect(within(fleetTable()).getByRole('columnheader', { name: /Capacity/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    ),
  )
  await waitFor(() =>
    expect(listedRegistrations().slice(0, 3)).toEqual(['NP-901-QR', 'CD-456-EF', 'AB-123-CD']),
  )
  await expect.poll(() => router.state.location.search).toMatchObject({ sort: 'capacity' })

  await user.click(within(fleetTable()).getByRole('button', { name: /Capacity/ }))

  await waitFor(() =>
    expect(within(fleetTable()).getByRole('columnheader', { name: /Capacity/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    ),
  )
  expect(listedRegistrations().slice(0, 3)).toEqual(['AB-123-CD', 'CD-456-EF', 'NP-901-QR'])
})

test('restores the sort from the address', JOURNEY, async () => {
  mockFleet()
  renderFleet('/transport-resources?sort=vehicleModel')
  await findFleetTable()

  expect(listedRegistrations().slice(0, 3)).toEqual(['NP-901-QR', 'CD-456-EF', 'AB-123-CD'])
})

test('says so when the site has no transport resource yet', JOURNEY, async () => {
  mockFleet({ companies: [], trucks: [] })
  renderFleet()

  expect(
    await screen.findByText('No transport resources yet', undefined, { timeout: 5000 }),
  ).toBeInTheDocument()
})

test('retries a failed load and renders the recovered fleet', JOURNEY, async () => {
  const user = userEvent.setup()
  let requests = 0
  mockFleet()
  server.use(
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, () => {
      requests += 1
      return requests === 1
        ? HttpResponse.json({ message: 'Unavailable' }, { status: 503 })
        : HttpResponse.json({ data: FLEET_COMPANIES })
    }),
  )
  renderFleet()

  expect(await screen.findByRole('alert', undefined, { timeout: 5000 })).toHaveTextContent(
    'Unable to load',
  )
  await user.click(screen.getByRole('button', { name: 'Try again' }))

  await findFleetTable()
  expect(groupHeader('Atlantic Transport')).toBeInTheDocument()
  expect(requests).toBeGreaterThanOrEqual(2)
})

test('keeps a 1,000-truck fleet counted and searched locally', { timeout: 60_000 }, async () => {
  const user = userEvent.setup()
  const companies = Array.from({ length: 10 }, (_, index) => ({
    ...FLEET_COMPANIES[0],
    id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    name: `Carrier ${String(index + 1).padStart(2, '0')}`,
  })) as TransportCompanyDto[]
  const trucks = Array.from({ length: 1_000 }, (_, index) => ({
    ...AB_123_CD,
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    registration: `SCALE-${String(index + 1).padStart(4, '0')}`,
    transportCompanyId: companies[index % 10]?.id ?? '',
    status: index % 4 === 0 ? 'ARCHIVED' : 'AVAILABLE',
  })) as TruckDto[]
  let completeRequests = 0
  mockFleet({
    companies,
    trucks,
    onCompleteTrucksRequest: () => {
      completeRequests += 1
    },
  })
  renderFleet()
  await findFleetTable()

  expect(statusPill('Available')).toHaveTextContent('750')
  expect(statusPill('Archived')).toHaveTextContent('250')
  const requestsBeforeSearch = completeRequests

  await user.type(screen.getByRole('textbox', { name: 'Search transport resources' }), '0999')

  await waitFor(() => expect(listedRegistrations()).toEqual(['SCALE-0999']))
  expect(completeRequests).toBe(requestsBeforeSearch)
})
