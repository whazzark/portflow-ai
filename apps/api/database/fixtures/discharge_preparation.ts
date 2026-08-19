import { Decimal } from 'decimal.js'
import { CUSTOMER_FIXTURES } from './customers.js'
import { DOCK_FIXTURE_EXEMPLARS, DOCK_FIXTURES } from './docks.js'
import { FIXTURE_REFERENCE_DATE, fixtureUuid } from './shared.js'
import { TRANSPORT_COMPANY_FIXTURES } from './transport_companies.js'
import { TRUCK_FIXTURES } from './trucks.js'
import { USER_FIXTURE_IDS } from './users.js'
import { WAREHOUSE_DOOR_FIXTURES } from './warehouse_doors.js'
import { WEIGHING_AREA_FIXTURES } from './weighing_areas.js'

const definitions = [
  {
    state: 'planned',
    status: 'PLANNED',
    shiftState: 'planned',
    shiftStatus: 'PLANNED',
    vesselName: 'MV Atlantic Dawn',
    offset: 0,
  },
  {
    state: 'active',
    status: 'ACTIVE',
    shiftState: 'active',
    shiftStatus: 'ACTIVE',
    vesselName: 'MV Ocean Cedar',
    offset: 1,
  },
  {
    state: 'closed',
    status: 'CLOSED',
    shiftState: 'completed',
    shiftStatus: 'COMPLETED',
    vesselName: 'MV Loire Star',
    offset: -30,
  },
] as const

const managedScenarioFixtures = definitions.map((definition, index) => {
  const sequence = index + 1
  const dischargeId = fixtureUuid(23600000, sequence)
  const shiftId = fixtureUuid(23600001, sequence)
  const productLotId = fixtureUuid(23600002, sequence)
  const truck = TRUCK_FIXTURES[index === 1 ? 1 : 0]
  const transportCompany = TRANSPORT_COMPANY_FIXTURES.find(
    (fixture) => fixture.id === truck.attributes.transportCompanyId,
  )
  const warehouseDoor = WAREHOUSE_DOOR_FIXTURES[index === 1 ? 2 : 0]
  const weighingArea = WEIGHING_AREA_FIXTURES[index === 1 ? 1 : 0]
  return {
    key: definition.state,
    discharge: {
      id: dischargeId,
      state: definition.state,
      attributes: {
        status: definition.status,
        vesselName: definition.vesselName,
        vesselImo: `930000${sequence}`,
        vesselComment: `Issue 236 ${definition.status.toLowerCase()} scenario`,
        dockId: DOCK_FIXTURE_EXEMPLARS.available.id,
        expectedStartAt: FIXTURE_REFERENCE_DATE.plus({ days: definition.offset }),
      },
    },
    productLots: [
      {
        id: productLotId,
        attributes: {
          dischargeId,
          customerId: CUSTOMER_FIXTURES[0].id,
          productName: `Céréales ${definition.status}`,
          expectedQuantityTonnes: new Decimal('1200.50'),
          description: null,
        },
      },
    ],
    truckAssignments: [
      {
        id: fixtureUuid(23600003, sequence),
        state: definition.state === 'closed' ? 'released' : 'reserved',
        attributes: {
          dischargeId,
          truckId: truck.id,
          registrationSnapshot: truck.attributes.registration,
          transportCompanyId: transportCompany?.id ?? null,
          transportCompanyNameSnapshot:
            transportCompany?.attributes.name ?? 'Transport non référencé',
          reservedAt: FIXTURE_REFERENCE_DATE,
          releasedAt:
            definition.state === 'closed' ? FIXTURE_REFERENCE_DATE.plus({ days: 2 }) : null,
        },
      },
    ],
    shifts: [
      {
        id: shiftId,
        state: definition.shiftState,
        attributes: {
          dischargeId,
          sequence: 1,
          status: definition.shiftStatus,
          plannedStartAt: FIXTURE_REFERENCE_DATE.plus({ days: definition.offset }),
          plannedEndAt: FIXTURE_REFERENCE_DATE.plus({ days: definition.offset, hours: 8 }),
          responsibleUserId: USER_FIXTURE_IDS.operationsLead,
        },
      },
    ],
    doorAssignments: [
      {
        id: fixtureUuid(23600004, sequence),
        attributes: {
          dischargeId,
          warehouseDoorId: warehouseDoor.id,
          productLotId,
          effectiveFrom: FIXTURE_REFERENCE_DATE,
          effectiveTo: null,
        },
      },
    ],
    shiftTrucks: [
      {
        id: fixtureUuid(23600005, sequence),
        attributes: {
          shiftId,
          truckId: truck.id,
          effectiveFrom: FIXTURE_REFERENCE_DATE,
          effectiveTo: null,
        },
      },
    ],
    shiftWarehouseDoors: [
      {
        id: fixtureUuid(23600006, sequence),
        attributes: {
          shiftId,
          warehouseDoorId: warehouseDoor.id,
          effectiveFrom: FIXTURE_REFERENCE_DATE,
          effectiveTo: null,
        },
      },
    ],
    shiftWeighingAreas: [
      {
        id: fixtureUuid(23600007, sequence),
        attributes: {
          shiftId,
          weighingAreaId: weighingArea.id,
          effectiveFrom: FIXTURE_REFERENCE_DATE,
          effectiveTo: null,
        },
      },
    ],
  }
})

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

const historicalProducts = [
  ['Blé tendre meunier', 1850.5, 'Réception pour meunerie et stockage longue durée'],
  ['Orge brassicole', 920.25, 'Lot destiné aux malteries de la façade Atlantique'],
  ['Tournesol oléique', 640.75, 'Graine oléique pour trituration régionale'],
  ['Granulés de bois', 1280.0, 'Combustible biomasse conditionné en vrac'],
  ['Engrais azoté', 760.4, 'Produit conditionné pour la campagne agricole'],
  ['Petcoke', 2125.8, 'Combustible minéral pour usage industriel'],
] as const

const operationalCustomers = CUSTOMER_FIXTURES.filter(
  (fixture) => fixture.attributes.status === 'AVAILABLE',
)
const operationalDocks = DOCK_FIXTURES.filter(
  (fixture) => fixture.attributes.status === 'AVAILABLE',
)
const operationalTrucks = TRUCK_FIXTURES.filter(
  (fixture) => fixture.attributes.status === 'AVAILABLE',
)
const operationalDoors = WAREHOUSE_DOOR_FIXTURES.filter(
  (fixture) => fixture.attributes.status === 'AVAILABLE',
)
const operationalWeighingAreas = WEIGHING_AREA_FIXTURES.filter(
  (fixture) => fixture.attributes.status === 'AVAILABLE',
)
const responsibleUsers = [
  USER_FIXTURE_IDS.operationsLead,
  USER_FIXTURE_IDS.operationsAdmin,
  USER_FIXTURE_IDS.organizationAdmin,
]

export const YEARLY_DISCHARGE_PREPARATION_FIXTURES = Array.from({ length: 12 }, (_, monthIndex) =>
  [0, 1].map((rotation) => {
    const sequence = monthIndex * 2 + rotation + 1
    const operationDate = FIXTURE_REFERENCE_DATE.minus({ months: 12 - monthIndex }).plus({
      days: rotation === 0 ? 4 : 18,
      hours: 6 + rotation * 3,
    })
    const vesselName = historicalVessels[(sequence - 1) % historicalVessels.length]
    const [productName, quantity, description] =
      historicalProducts[(sequence - 1) % historicalProducts.length]
    const customer = operationalCustomers[(sequence - 1) % operationalCustomers.length]
    const dock = operationalDocks[(sequence - 1) % operationalDocks.length]
    const truck = operationalTrucks[(sequence - 1) % operationalTrucks.length]
    const transportCompany = TRANSPORT_COMPANY_FIXTURES.find(
      (fixture) => fixture.id === truck.attributes.transportCompanyId,
    )
    const door = operationalDoors[(sequence - 1) % operationalDoors.length]
    const weighingArea = operationalWeighingAreas[(sequence - 1) % operationalWeighingAreas.length]
    const dischargeId = fixtureUuid(23610000, sequence)
    const productLotId = fixtureUuid(23610001, sequence)
    const truckAssignmentId = fixtureUuid(23610002, sequence)
    const shiftId = fixtureUuid(23610003, sequence)
    const doorAssignmentId = fixtureUuid(23610004, sequence)
    const shiftTruckId = fixtureUuid(23610005, sequence)
    const shiftDoorId = fixtureUuid(23610006, sequence)
    const shiftWeighingAreaId = fixtureUuid(23610007, sequence)
    const shiftStart = operationDate.plus({ hours: 1 })
    const shiftEnd = shiftStart.plus({ hours: 8 })
    const releasedAt = shiftEnd.plus({ hours: 2 })

    return {
      key: `closed-${operationDate.toISODate()}-${rotation + 1}`,
      discharge: {
        id: dischargeId,
        state: 'closed' as const,
        attributes: {
          status: 'CLOSED' as const,
          vesselName: `${vesselName} ${2024 + ((monthIndex + rotation) % 3)}`,
          vesselImo: String(9410000 + sequence),
          vesselComment: `Escale historique de ${productName.toLowerCase()}`,
          dockId: dock.id,
          expectedStartAt: operationDate,
          createdAt: operationDate.minus({ days: 45 }),
          updatedAt: releasedAt,
        },
      },
      productLots: [
        {
          id: productLotId,
          attributes: {
            dischargeId,
            customerId: customer.id,
            productName,
            expectedQuantityTonnes: new Decimal(String(quantity + (sequence % 4) * 12.5)),
            description,
            createdAt: operationDate.minus({ days: 12 }),
            updatedAt: releasedAt,
          },
        },
      ],
      truckAssignments: [
        {
          id: truckAssignmentId,
          state: 'released' as const,
          attributes: {
            dischargeId,
            truckId: truck.id,
            registrationSnapshot: truck.attributes.registration,
            transportCompanyId: transportCompany?.id ?? null,
            transportCompanyNameSnapshot:
              transportCompany?.attributes.name ?? 'Transport non référencé',
            reservedAt: operationDate,
            releasedAt,
            createdAt: operationDate,
            updatedAt: releasedAt,
          },
        },
      ],
      shifts: [
        {
          id: shiftId,
          state: 'completed' as const,
          attributes: {
            dischargeId,
            sequence: 1,
            status: 'COMPLETED' as const,
            plannedStartAt: shiftStart,
            plannedEndAt: shiftEnd,
            responsibleUserId: responsibleUsers[(sequence - 1) % responsibleUsers.length],
            createdAt: operationDate.minus({ days: 2 }),
            updatedAt: releasedAt,
          },
        },
      ],
      doorAssignments: [
        {
          id: doorAssignmentId,
          attributes: {
            dischargeId,
            warehouseDoorId: door.id,
            productLotId,
            effectiveFrom: shiftStart,
            effectiveTo: shiftEnd,
            createdAt: operationDate,
            updatedAt: releasedAt,
          },
        },
      ],
      shiftTrucks: [
        {
          id: shiftTruckId,
          attributes: {
            shiftId,
            truckId: truck.id,
            effectiveFrom: shiftStart,
            effectiveTo: shiftEnd,
            createdAt: operationDate,
            updatedAt: releasedAt,
          },
        },
      ],
      shiftWarehouseDoors: [
        {
          id: shiftDoorId,
          attributes: {
            shiftId,
            warehouseDoorId: door.id,
            effectiveFrom: shiftStart,
            effectiveTo: shiftEnd,
            createdAt: operationDate,
            updatedAt: releasedAt,
          },
        },
      ],
      shiftWeighingAreas: [
        {
          id: shiftWeighingAreaId,
          attributes: {
            shiftId,
            weighingAreaId: weighingArea.id,
            effectiveFrom: shiftStart,
            effectiveTo: shiftEnd,
            createdAt: operationDate,
            updatedAt: releasedAt,
          },
        },
      ],
    }
  }),
).flat()

export const DISCHARGE_PREPARATION_FIXTURES = [
  ...managedScenarioFixtures,
  ...YEARLY_DISCHARGE_PREPARATION_FIXTURES,
]

export const DISCHARGE_PREPARATION_FIXTURE_EXEMPLARS = {
  planned: DISCHARGE_PREPARATION_FIXTURES[0],
  active: DISCHARGE_PREPARATION_FIXTURES[1],
  closed: DISCHARGE_PREPARATION_FIXTURES[2],
} as const
