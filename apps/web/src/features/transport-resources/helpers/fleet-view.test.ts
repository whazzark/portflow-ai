import { describe, expect, test } from 'vitest'

import {
  AB_123_CD,
  ATLANTIC_ID,
  BRETAGNE_ID,
  CD_456_EF,
  EF_789_GH,
  FLEET_COMPANIES,
  FLEET_TRUCKS,
  GH_012_JK,
  LOIRE_ID,
  MORVAN_ID,
  QR_234_ST,
} from '@/features/transport-resources/__tests__/support/fleet-fixtures'
import type { TruckDto } from '@/features/trucks/types'
import { buildFleetView, type FleetViewInput } from './fleet-view'

const ADMIN_DEFAULTS: FleetViewInput = {
  companies: FLEET_COMPANIES,
  trucks: FLEET_TRUCKS,
  statuses: ['available', 'suspended'],
  search: '',
  sort: 'registration',
  order: 'asc',
  administrator: true,
}

/** What a non-administrator reads: no archived truck. */
const READABLE_TRUCKS = FLEET_TRUCKS.filter((truck) => truck.status !== 'ARCHIVED')

function view(overrides: Partial<FleetViewInput> = {}) {
  return buildFleetView({ ...ADMIN_DEFAULTS, ...overrides })
}

function shape(overrides: Partial<FleetViewInput> = {}) {
  return view(overrides).groups.map((group) => ({
    company: group.company.name,
    trucks: group.trucks.map(({ truck }) => truck.registration),
  }))
}

describe('status membership', () => {
  test('lists available and suspended trucks under their available companies, by company name', () => {
    expect(shape()).toEqual([
      { company: 'Atlantic Transport', trucks: ['AB-123-CD', 'CD-456-EF', 'NP-901-QR'] },
      { company: 'Bretagne Vrac', trucks: ['JK-345-LM', 'LM-678-NP'] },
      { company: 'Loire Logistique', trucks: ['EF-789-GH', 'GH-012-JK'] },
    ])
  })

  test('hides the companies with no truck in the selected statuses', () => {
    expect(shape({ statuses: ['suspended'] })).toEqual([
      { company: 'Atlantic Transport', trucks: ['NP-901-QR'] },
      { company: 'Loire Logistique', trucks: ['GH-012-JK'] },
    ])
  })

  test('lists archived companies with their archived trucks when archived is selected', () => {
    expect(shape({ statuses: ['archived'] })).toEqual([
      { company: 'Transports Morvan', trucks: ['QR-234-ST'] },
    ])
  })

  test('lists an archived truck of an available company under that company', () => {
    const archivedAtAtlantic: TruckDto = { ...AB_123_CD, status: 'ARCHIVED' }

    expect(
      shape({
        trucks: [archivedAtAtlantic, CD_456_EF, QR_234_ST],
        statuses: ['archived'],
      }),
    ).toEqual([
      { company: 'Atlantic Transport', trucks: ['AB-123-CD'] },
      { company: 'Transports Morvan', trucks: ['QR-234-ST'] },
    ])
  })

  test('keeps a just-created company visible while it has no truck', () => {
    expect(shape({ trucks: [], pinnedCompanyId: BRETAGNE_ID })).toEqual([
      { company: 'Bretagne Vrac', trucks: [] },
    ])
  })
})

describe('search', () => {
  test('matches a truck on its registration', () => {
    expect(shape({ search: 'ef-789' })).toEqual([
      { company: 'Loire Logistique', trucks: ['EF-789-GH'] },
    ])
  })

  test('matches a truck on its vehicle model', () => {
    expect(shape({ search: 'scania' })).toEqual([
      { company: 'Atlantic Transport', trucks: ['CD-456-EF', 'NP-901-QR'] },
    ])
  })

  test('matches every listed truck of a company on its name', () => {
    expect(shape({ search: 'bretagne' })).toEqual([
      { company: 'Bretagne Vrac', trucks: ['JK-345-LM', 'LM-678-NP'] },
    ])
  })

  test('keeps a company matching by name even when none of its trucks is listed', () => {
    expect(shape({ search: 'bretagne', statuses: ['suspended'] })).toEqual([
      { company: 'Bretagne Vrac', trucks: [] },
    ])
  })

  test('leaves an archived company out when only its name matches and archived is not selected', () => {
    expect(shape({ search: 'morvan' })).toEqual([])
    expect(shape({ search: 'morvan', statuses: ['archived'] })).toEqual([
      { company: 'Transports Morvan', trucks: ['QR-234-ST'] },
    ])
  })

  test('respects the selected statuses', () => {
    expect(shape({ search: 'QR-234' })).toEqual([])
    expect(view({ search: 'QR-234' }).isEmpty).toBe(true)
  })
})

describe('company filter', () => {
  test('keeps only the filtered company and counts the others it hides', () => {
    const result = view({ transportCompanyId: LOIRE_ID })

    expect(result.groups.map((group) => group.company.name)).toEqual(['Loire Logistique'])
    expect(result.filteredCompany).toEqual({ id: LOIRE_ID, name: 'Loire Logistique' })
    expect(result.hiddenCompanyCount).toBe(2)
  })

  test('behaves as no filter for an unknown company', () => {
    const result = view({ transportCompanyId: 'unknown' })

    expect(result.groups).toHaveLength(3)
    expect(result.filteredCompany).toBeUndefined()
    expect(result.hiddenCompanyCount).toBe(0)
  })
})

describe('sort', () => {
  test('sorts within each group, descending on demand', () => {
    expect(shape({ order: 'desc' })[0]?.trucks).toEqual(['NP-901-QR', 'CD-456-EF', 'AB-123-CD'])
  })

  test('sorts by capacity', () => {
    expect(shape({ sort: 'capacity' })[0]?.trucks).toEqual(['NP-901-QR', 'CD-456-EF', 'AB-123-CD'])
  })

  test('sorts a missing vehicle model last in both directions', () => {
    const noModel: TruckDto = { ...CD_456_EF, vehicleModel: null }
    const trucks = [AB_123_CD, noModel]

    expect(shape({ trucks, sort: 'vehicleModel' })[0]?.trucks).toEqual(['AB-123-CD', 'CD-456-EF'])
    expect(shape({ trucks, sort: 'vehicleModel', order: 'desc' })[0]?.trucks).toEqual([
      'AB-123-CD',
      'CD-456-EF',
    ])
  })

  test('orders statuses available, suspended, archived, ties by registration', () => {
    expect(shape({ sort: 'status' })[2]?.trucks).toEqual(['EF-789-GH', 'GH-012-JK'])
    expect(shape({ sort: 'status', order: 'desc' })[2]?.trucks).toEqual(['GH-012-JK', 'EF-789-GH'])
  })
})

describe('counts and summaries', () => {
  test('counts the whole fleet, regardless of search and company filter', () => {
    expect(view().counts).toEqual({ available: 5, suspended: 2, archived: 1 })
    expect(view({ search: 'zz-999', transportCompanyId: LOIRE_ID }).counts).toEqual({
      available: 5,
      suspended: 2,
      archived: 1,
    })
  })

  test('counts archived companies for a non-administrator, who reads no archived truck', () => {
    expect(view({ administrator: false, trucks: READABLE_TRUCKS }).counts).toEqual({
      available: 5,
      suspended: 2,
      archived: 1,
    })
    expect(
      shape({ administrator: false, trucks: READABLE_TRUCKS, statuses: ['archived'] }),
    ).toEqual([{ company: 'Transports Morvan', trucks: [] }])
  })

  test('summarises each group from all its trucks, unaffected by filters', () => {
    const loire = view({ statuses: ['suspended'] }).groups.find(
      (group) => group.company.id === LOIRE_ID,
    )

    expect(loire?.summary).toEqual({ available: 1, suspended: 1 })
    expect(loire?.archiveBlockedBy).toBe(1)
  })
})

describe('reactivation and notice', () => {
  test('a truck of an archived company cannot be reactivated, and the notice says why', () => {
    const result = view({ statuses: ['archived'] })
    const morvan = result.groups.find((group) => group.company.id === MORVAN_ID)

    expect(morvan?.trucks[0]?.canReactivate).toBe(false)
    expect(result.showArchivedNotice).toBe(true)
  })

  test('a truck of an available company can be reactivated and raises no notice', () => {
    const archivedAtAtlantic: TruckDto = { ...AB_123_CD, status: 'ARCHIVED' }
    const result = view({ trucks: [archivedAtAtlantic], statuses: ['archived'] })
    const atlantic = result.groups.find((group) => group.company.id === ATLANTIC_ID)

    expect(atlantic?.trucks[0]?.canReactivate).toBe(true)
    expect(result.showArchivedNotice).toBe(false)
  })

  test('raises no notice outside the archived view', () => {
    expect(view().showArchivedNotice).toBe(false)
  })
})

test('maps each truck status to its lifecycle', () => {
  const loire = view().groups.find((group) => group.company.id === LOIRE_ID)

  expect(loire?.trucks.map(({ truck, status }) => [truck.id, status])).toEqual([
    [EF_789_GH.id, 'available'],
    [GH_012_JK.id, 'suspended'],
  ])
})
