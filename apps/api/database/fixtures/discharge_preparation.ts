import { Decimal } from 'decimal.js'
import { DateTime } from 'luxon'
import { CUSTOMER_FIXTURES } from './customers.js'
import { DOCK_FIXTURES } from './docks.js'
import { fixtureUuid } from './shared.js'
import { TRANSPORT_COMPANY_FIXTURES } from './transport_companies.js'
import { TRUCK_FIXTURES, TRUCK_FLEET_FIXTURES } from './trucks.js'
import { USER_FIXTURE_IDS } from './users.js'
import { WAREHOUSE_DOOR_FIXTURES } from './warehouse_doors.js'
import { WEIGHING_AREA_FIXTURES } from './weighing_areas.js'

/**
 * Discharges are seeded around the moment the seed runs rather than the fixed reference date, so
 * the shift timeline always has work behind, under way, and ahead: planned discharges start in the
 * coming days, active ones rotate across the current hour, and closed ones spread over the past
 * year. Shift hours are wall-clock times at the site.
 */
const SITE_ZONE = 'Europe/Paris'
const seededAt = DateTime.now()
const seedDay = seededAt.setZone(SITE_ZONE).startOf('day')

const siteTime = (day: number, time: string) => {
  const [hour, minute] = time.split(':').map(Number)
  return seedDay.plus({ days: day }).set({ hour, minute })
}

/** Deterministic pseudo-random draws (mulberry32), so every seed selects the same subsets. */
function randomSource(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickSome<T>(random: () => number, items: readonly T[], ratio: number, min: number) {
  const picked = items.filter(() => random() < ratio)
  for (const item of items) {
    if (picked.length >= min) {
      break
    }
    if (!picked.includes(item)) {
      picked.push(item)
    }
  }
  return picked
}

function shuffle<T>(random: () => number, items: readonly T[]) {
  return items
    .map((item) => ({ item, rank: random() }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ item }) => item)
}

function byName<T extends { id: string; attributes: { name: string } }>(
  fixtures: readonly T[],
  name: string,
) {
  const fixture = fixtures.find((candidate) => candidate.attributes.name === name)
  if (!fixture) {
    throw new Error(`Unknown discharge fixture reference: ${name}`)
  }
  return fixture.id
}

type Truck = (typeof TRUCK_FIXTURES)[number]

const truck = (registration: string) => {
  const fixture = TRUCK_FIXTURES.find(
    (candidate) => candidate.attributes.registration === registration,
  )
  if (!fixture) {
    throw new Error(`Unknown discharge fixture truck: ${registration}`)
  }
  return fixture
}
const fleet = (from: number, to: number) => TRUCK_FLEET_FIXTURES.slice(from, to + 1)

const door = (name: string) => byName(WAREHOUSE_DOOR_FIXTURES, name)
const weighingArea = (name: string) => byName(WEIGHING_AREA_FIXTURES, name)
const dock = (name: string) => byName(DOCK_FIXTURES, name)

const operationalCustomers = CUSTOMER_FIXTURES.filter(
  (fixture) => fixture.attributes.status === 'AVAILABLE',
)
const operationalDocks = DOCK_FIXTURES.filter(
  (fixture) => fixture.attributes.status === 'AVAILABLE',
)
const operationalDoors = WAREHOUSE_DOOR_FIXTURES.filter(
  (fixture) => fixture.attributes.status === 'AVAILABLE',
).map((fixture) => fixture.id)
const operationalWeighingAreas = WEIGHING_AREA_FIXTURES.filter(
  (fixture) => fixture.attributes.status === 'AVAILABLE',
).map((fixture) => fixture.id)
const selectableTrucks = TRUCK_FIXTURES.filter(
  (fixture) => fixture.attributes.status === 'AVAILABLE',
)

// Only the roles allowed to lead a shift.
const responsibleUsers = [
  USER_FIXTURE_IDS.operationsLead,
  USER_FIXTURE_IDS.operationsAdmin,
  USER_FIXTURE_IDS.organizationAdmin,
]

const products = [
  ['Blé tendre meunier', 'Réception pour meunerie et stockage longue durée'],
  ['Orge brassicole', 'Lot destiné aux malteries de la façade Atlantique'],
  ['Tournesol oléique', 'Graine oléique pour trituration régionale'],
  ['Granulés de bois', 'Combustible biomasse conditionné en vrac'],
  ['Engrais azoté', 'Produit conditionné pour la campagne agricole'],
  ['Petcoke', 'Combustible minéral pour usage industriel'],
  ['Blé dur', null],
  ['Maïs grain', null],
  ['Colza', null],
  ['Pois protéagineux', null],
  ['Tourteau de soja', null],
  ['Ammonitrate', null],
  ['Urée granulée', null],
  ['Clinker', null],
  ['Kaolin', null],
  ['Sucre roux', null],
  ['Sel de déneigement', null],
  ['Ciment', null],
  ['Avoine', null],
  ['Luzerne déshydratée', null],
] as const

type Slot = { day: number; start: string; endDay: number; end: string; withoutTrucks?: boolean }

const PATTERNS = {
  '3x8': [
    ['06:00', 0, '14:00'],
    ['14:00', 0, '22:00'],
    ['22:00', 1, '06:00'],
  ],
  '2x8': [
    ['06:00', 0, '14:00'],
    ['14:00', 0, '22:00'],
  ],
  '2x12': [
    ['06:00', 0, '18:00'],
    ['18:00', 1, '06:00'],
  ],
  day: [
    ['07:00', 0, '12:00'],
    ['13:30', 0, '19:00'],
  ],
} as const satisfies Record<string, ReadonlyArray<readonly [string, number, string]>>

type Pattern = keyof typeof PATTERNS

/** Every slot of a pattern from one day to another, less the `day@start` slots left as breaks. */
const rotation = (fromDay: number, toDay: number, pattern: Pattern, breaks: string[] = []) =>
  Array.from({ length: toDay - fromDay + 1 }, (_, index) => fromDay + index).flatMap((day) =>
    PATTERNS[pattern]
      .filter(([start]) => !breaks.includes(`${day}@${start}`))
      .map(([start, endOffset, end]): Slot => ({ day, start, endDay: day + endOffset, end })),
  )

type Scenario = {
  id: string
  status: 'PLANNED' | 'ACTIVE' | 'CLOSED'
  vesselName: string
  vesselImo: string
  vesselComment: string
  dockId: string
  lotCount: number
  doorIds: string[]
  weighingAreaIds: string[]
  held: Truck[]
  released?: Truck[]
  /** The day the pool was reserved; a planned discharge reserves at seed time. */
  reservedDay?: number
  shifts: Slot[]
}

// The discharges the feature quickstarts name keep their identity; their plan is enlarged.
const managedScenarios: Scenario[] = [
  {
    id: fixtureUuid(23600000, 1),
    status: 'PLANNED',
    vesselName: 'MV Atlantic Dawn',
    vesselImo: '9300001',
    vesselComment: 'Issue 236 planned scenario',
    dockId: dock("Môle d'Escale Ouest"),
    lotCount: 6,
    doorIds: [door('Porte Nord'), door('Porte Douane'), door('Porte Quai')],
    weighingAreaIds: [weighingArea('Pont-bascule Nord'), weighingArea('Pont-bascule Sud')],
    held: [truck('AA-101-PF'), truck('EE-505-PF'), ...fleet(32, 37), ...fleet(39, 39)],
    shifts: rotation(12, 14, '2x8', ['13@14:00']),
  },
  {
    id: fixtureUuid(23600000, 2),
    status: 'ACTIVE',
    vesselName: 'MV Ocean Cedar',
    vesselImo: '9300002',
    vesselComment: 'Issue 236 active scenario',
    dockId: dock("Môle d'Escale Ouest"),
    lotCount: 5,
    doorIds: [door('Porte Douane'), door('Porte Nord')],
    weighingAreaIds: [weighingArea('Pont-bascule Nord')],
    held: [truck('BB-202-PF'), ...fleet(24, 31)],
    released: [truck('CC-303-PF')],
    reservedDay: -3,
    shifts: rotation(-1, 3, '3x8', ['3@22:00']),
  },
  {
    id: fixtureUuid(23600000, 3),
    status: 'CLOSED',
    vesselName: 'MV Loire Star',
    vesselImo: '9300003',
    vesselComment: 'Issue 236 closed scenario',
    dockId: dock("Môle d'Escale Ouest"),
    lotCount: 4,
    doorIds: [door('Porte Nord'), door('Porte Principale')],
    weighingAreaIds: [weighingArea('Pont-bascule Nord')],
    held: [],
    released: [truck('AA-101-PF'), ...fleet(0, 4)],
    reservedDay: -32,
    shifts: rotation(-30, -29, '2x8'),
  },
]

// Shapes of plan the shift timeline has to draw. Active discharges hold disjoint trucks and doors.
const timelineScenarios: Scenario[] = [
  {
    id: fixtureUuid(23620000, 1),
    status: 'PLANNED',
    vesselName: 'MV Timeline Multi-Jours',
    vesselImo: '9399901',
    vesselComment:
      'Planifié sur 5 jours : 3x8 puis 2x8, pauses, camions partagés et suspendu, lots sans porte',
    dockId: dock("Môle d'Escale Est"),
    lotCount: 8,
    doorIds: [door('Porte Nord'), door('Porte Quai'), door('Porte Camions')],
    weighingAreaIds: [weighingArea('Pont-bascule Nord'), weighingArea('Pont-bascule Sud')],
    held: [
      truck('AA-101-PF'),
      truck('CC-303-PF'),
      truck('EE-505-PF'),
      ...fleet(24, 34),
      ...fleet(5, 5),
      ...fleet(39, 39),
    ],
    shifts: [
      ...rotation(2, 3, '3x8', ['3@22:00']),
      ...rotation(4, 4, '2x8'),
      { day: 5, start: '08:00', endDay: 5, end: '16:00' },
      { day: 6, start: '07:00', endDay: 6, end: '11:30', withoutTrucks: true },
    ],
  },
  {
    id: fixtureUuid(23620000, 2),
    status: 'PLANNED',
    vesselName: 'MV Nordic Breeze',
    vesselImo: '9399902',
    vesselComment: 'Même période que Timeline Multi-Jours : camions partagés, avec avertissement',
    dockId: dock('Anse Saint-Marc 1'),
    lotCount: 4,
    doorIds: [door('Porte Camions'), door('Porte de Service')],
    weighingAreaIds: [weighingArea('Pont-bascule Sud')],
    held: [truck('AA-101-PF'), truck('CC-303-PF'), ...fleet(24, 28), ...fleet(36, 36)],
    shifts: [...rotation(3, 4, '2x8'), { day: 5, start: '06:00', endDay: 5, end: '12:00' }],
  },
  {
    id: fixtureUuid(23620000, 3),
    status: 'PLANNED',
    vesselName: 'MV Polar Grain',
    vesselImo: '9399903',
    vesselComment: 'Rotation 2x12 continue sur 3 jours, un camion suspendu non sélectionné',
    dockId: dock("Môle d'Escale Ouest"),
    lotCount: 5,
    doorIds: [door('Porte Réfrigérée Est'), door('Porte de Service'), door('Porte Principale')],
    weighingAreaIds: [weighingArea('Pont-bascule Nord')],
    held: [...fleet(29, 35), ...fleet(37, 38), ...fleet(15, 15)],
    shifts: rotation(6, 8, '2x12', ['8@18:00']),
  },
  {
    id: fixtureUuid(23620000, 4),
    status: 'PLANNED',
    vesselName: 'MV Sirocco',
    vesselImo: '9399904',
    vesselComment: 'Préparation à peine commencée : pool vide, lots sans porte',
    dockId: dock('Chef de Baie 1'),
    lotCount: 3,
    doorIds: [],
    weighingAreaIds: [],
    held: [],
    shifts: rotation(9, 10, 'day'),
  },
  {
    id: fixtureUuid(23620000, 5),
    status: 'ACTIVE',
    vesselName: 'MV Iroise Trader',
    vesselImo: '9399905',
    vesselComment:
      'En 3x8 depuis 2 jours : shifts terminés, en cours et à venir, deux camions libérés',
    dockId: dock('Anse Saint-Marc 1'),
    lotCount: 6,
    doorIds: [door('Porte Principale'), door('Porte de Service'), door('Porte Camions')],
    weighingAreaIds: [weighingArea('Pont-bascule Nord')],
    held: fleet(0, 11),
    released: fleet(12, 13),
    reservedDay: -4,
    shifts: rotation(-2, 2, '3x8', ['-2@22:00', '2@22:00']),
  },
  {
    id: fixtureUuid(23620000, 6),
    status: 'ACTIVE',
    vesselName: 'MV Mistral',
    vesselImo: '9399906',
    vesselComment: 'En 2x12 : chaque shift de nuit passe minuit, une pause le deuxième jour',
    dockId: dock('Anse Saint-Marc 2'),
    lotCount: 4,
    doorIds: [door('Porte Réfrigérée Est'), door('Porte Quai')],
    weighingAreaIds: [weighingArea('Pont-bascule Sud')],
    held: fleet(14, 23),
    reservedDay: -5,
    shifts: rotation(-3, 2, '2x12', ['-2@18:00']),
  },
  {
    id: fixtureUuid(23620000, 7),
    status: 'CLOSED',
    vesselName: 'MV Loire Horizon',
    vesselImo: '9399907',
    vesselComment: 'Terminé il y a 10 jours, en 2x8',
    dockId: dock("Môle d'Escale Ouest"),
    lotCount: 6,
    doorIds: [door('Porte Nord'), door('Porte Quai')],
    weighingAreaIds: [weighingArea('Pont-bascule Nord')],
    held: [],
    released: [truck('AA-101-PF'), truck('BB-202-PF'), ...fleet(0, 7)],
    reservedDay: -16,
    shifts: rotation(-14, -10, '2x8', ['-10@14:00']),
  },
  {
    id: fixtureUuid(23620000, 8),
    status: 'CLOSED',
    vesselName: 'MV Brume Matinale',
    vesselImo: '9399908',
    vesselComment: 'Terminé il y a 3 semaines, en deux jours',
    dockId: dock("Môle d'Escale Est"),
    lotCount: 3,
    doorIds: [door('Porte Camions')],
    weighingAreaIds: [weighingArea('Pont-bascule Sud')],
    held: [],
    released: [truck('BB-202-PF'), truck('EE-505-PF'), ...fleet(14, 17)],
    reservedDay: -24,
    shifts: rotation(-22, -21, '2x8'),
  },
]

const historicalVessels = [
  'MV Asteria',
  'MV Belle Île',
  'MV Capella',
  'MV Dorian',
  'MV Émeraude',
  'MV Fidélité',
  'MV Galatea',
  'MV Horizon',
] as const

const historicalRotations: Array<[Pattern, number]> = [
  ['2x8', 2],
  ['3x8', 1],
  ['day', 2],
  ['2x12', 1],
  ['2x8', 3],
  ['3x8', 2],
]

// Two calls a month over the past year, each with its own rotation and released pool.
const historicalScenarios: Scenario[] = Array.from({ length: 24 }, (_, index) => {
  const sequence = index + 1
  const random = randomSource(23610000 + sequence)
  const [pattern, days] = historicalRotations[index % historicalRotations.length]
  const startDay = -40 - index * 13
  const monthIndex = Math.floor(index / 2)
  const rotationIndex = index % 2

  return {
    id: fixtureUuid(23610000, sequence),
    status: 'CLOSED',
    vesselName: `${historicalVessels[index % historicalVessels.length]} ${2024 + ((monthIndex + rotationIndex) % 3)}`,
    vesselImo: String(9410000 + sequence),
    vesselComment: `Escale historique de ${products[index % products.length][0].toLowerCase()}`,
    dockId: operationalDocks[index % operationalDocks.length].id,
    lotCount: 3 + Math.floor(random() * 5),
    doorIds: shuffle(random, operationalDoors).slice(0, 1 + Math.floor(random() * 3)),
    weighingAreaIds: shuffle(random, operationalWeighingAreas).slice(
      0,
      1 + Math.floor(random() * 2),
    ),
    held: [],
    released: shuffle(random, selectableTrucks).slice(0, 4 + Math.floor(random() * 7)),
    reservedDay: startDay - 2,
    shifts: rotation(startDay, startDay + days - 1, pattern),
  }
})

const transportCompanyOf = (fixture: Truck) =>
  TRANSPORT_COMPANY_FIXTURES.find((company) => company.id === fixture.attributes.transportCompanyId)

function buildFixture(scenario: Scenario, ordinal: number) {
  const random = randomSource(ordinal + 1)
  const childId = (domain: number, index: number) => fixtureUuid(domain, ordinal * 1000 + index)
  const dischargeId = scenario.id
  const released = scenario.released ?? []
  const firstShift = scenario.shifts[0]
  const lastShift = scenario.shifts.at(-1) ?? firstShift
  const reservedAt =
    scenario.reservedDay === undefined ? seededAt : siteTime(scenario.reservedDay, '09:00')
  // A closed discharge releases its pool when its last shift ends; an active one released its
  // trucks the day before the seed.
  const releasedAt =
    scenario.status === 'CLOSED' ? siteTime(lastShift.endDay, lastShift.end) : siteTime(-1, '12:00')
  const closedAt = scenario.status === 'CLOSED' ? releasedAt : null

  const productLots = Array.from({ length: scenario.lotCount }, (_, index) => {
    const [productName, description] = products[(ordinal * 5 + index) % products.length]
    return {
      id: childId(23630001, index + 1),
      attributes: {
        dischargeId,
        customerId: operationalCustomers[(ordinal + index) % operationalCustomers.length].id,
        productName,
        expectedQuantityTonnes: new Decimal(
          (400 + Math.floor(random() * 46) * 100 + Math.floor(random() * 1000) / 4).toFixed(3),
        ),
        description,
      },
    }
  })

  // While a discharge is prepared, one lot in four still waits for its warehouse door.
  const doorAssignments = productLots.flatMap((lot, index) =>
    scenario.doorIds.length === 0 || (scenario.status === 'PLANNED' && index % 4 === 3)
      ? []
      : [
          {
            id: childId(23630004, index + 1),
            attributes: {
              dischargeId,
              warehouseDoorId: scenario.doorIds[index % scenario.doorIds.length],
              productLotId: lot.id,
              effectiveFrom: reservedAt,
              effectiveTo: closedAt,
            },
          },
        ],
  )

  const truckAssignments = [...scenario.held, ...released].map((fixture, index) => {
    const company = transportCompanyOf(fixture)
    return {
      id: childId(23630002, index + 1),
      attributes: {
        dischargeId,
        truckId: fixture.id,
        registrationSnapshot: fixture.attributes.registration,
        transportCompanyId: company?.id ?? null,
        transportCompanyNameSnapshot: company?.attributes.name ?? 'Transport non référencé',
        reservedAt,
        releasedAt: released.includes(fixture) ? releasedAt : null,
      },
    }
  })

  // A closed discharge worked with the trucks it has since released; the others with their pool.
  const workingTrucks = (scenario.status === 'CLOSED' ? released : scenario.held).filter(
    (fixture) => fixture.attributes.status === 'AVAILABLE',
  )
  const suspendedTrucks = scenario.held.filter(
    (fixture) => fixture.attributes.status === 'SUSPENDED',
  )

  const shiftTrucks: Array<{ id: string; attributes: object }> = []
  const shiftWarehouseDoors: Array<{ id: string; attributes: object }> = []
  const shiftWeighingAreas: Array<{ id: string; attributes: object }> = []

  const shifts = scenario.shifts.map((slot, index) => {
    const shiftId = childId(23630003, index + 1)
    const plannedStartAt = siteTime(slot.day, slot.start)
    const plannedEndAt = siteTime(slot.endDay, slot.end)
    const status =
      scenario.status === 'PLANNED'
        ? ('PLANNED' as const)
        : scenario.status === 'CLOSED' || plannedEndAt <= seededAt
          ? ('COMPLETED' as const)
          : plannedStartAt <= seededAt
            ? ('ACTIVE' as const)
            : ('PLANNED' as const)
    const membership = { shiftId, effectiveFrom: reservedAt, effectiveTo: closedAt }

    const trucks = slot.withoutTrucks
      ? []
      : pickSome(random, workingTrucks, 0.5, Math.min(2, workingTrucks.length))
    // A suspended truck stays selected on the third shift, as if suspended after its selection.
    if (index === 2) {
      trucks.push(...suspendedTrucks.slice(-1))
    }
    for (const fixture of trucks) {
      shiftTrucks.push({
        id: childId(23630005, shiftTrucks.length + 1),
        attributes: { ...membership, truckId: fixture.id },
      })
    }
    const minResources = scenario.status === 'PLANNED' ? 0 : 1
    for (const warehouseDoorId of pickSome(random, scenario.doorIds, 0.6, minResources)) {
      shiftWarehouseDoors.push({
        id: childId(23630006, shiftWarehouseDoors.length + 1),
        attributes: { ...membership, warehouseDoorId },
      })
    }
    for (const weighingAreaId of pickSome(random, scenario.weighingAreaIds, 0.7, minResources)) {
      shiftWeighingAreas.push({
        id: childId(23630007, shiftWeighingAreas.length + 1),
        attributes: { ...membership, weighingAreaId },
      })
    }

    return {
      id: shiftId,
      attributes: {
        dischargeId,
        sequence: index + 1,
        status,
        plannedStartAt,
        plannedEndAt,
        responsibleUserId: responsibleUsers[index % responsibleUsers.length],
      },
    }
  })

  return {
    key: `${scenario.status.toLowerCase()}-${scenario.vesselName}`,
    discharge: {
      id: dischargeId,
      attributes: {
        status: scenario.status,
        vesselName: scenario.vesselName,
        vesselImo: scenario.vesselImo,
        vesselComment: scenario.vesselComment,
        dockId: scenario.dockId,
        expectedStartAt: siteTime(firstShift.day, firstShift.start),
      },
    },
    productLots,
    truckAssignments,
    shifts,
    doorAssignments,
    shiftTrucks,
    shiftWarehouseDoors,
    shiftWeighingAreas,
  }
}

export const DISCHARGE_PREPARATION_FIXTURES = [
  ...managedScenarios,
  ...timelineScenarios,
  ...historicalScenarios,
].map(buildFixture)

export const DISCHARGE_PREPARATION_FIXTURE_EXEMPLARS = {
  planned: DISCHARGE_PREPARATION_FIXTURES[0],
  active: DISCHARGE_PREPARATION_FIXTURES[1],
  closed: DISCHARGE_PREPARATION_FIXTURES[2],
} as const
