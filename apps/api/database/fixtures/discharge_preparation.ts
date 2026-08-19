import { Decimal } from 'decimal.js'
import { CUSTOMER_FIXTURE_IDS } from './customers.js'
import { DOCK_FIXTURE_EXEMPLARS } from './docks.js'
import { FIXTURE_REFERENCE_DATE, fixtureUuid } from './shared.js'
import { TRANSPORT_COMPANY_FIXTURE_IDS } from './transport_companies.js'
import { TRUCK_FIXTURE_IDS } from './trucks.js'
import { USER_FIXTURE_IDS } from './users.js'
import { WAREHOUSE_DOOR_FIXTURE_IDS } from './warehouse_doors.js'
import { WEIGHING_AREA_FIXTURE_EXEMPLARS } from './weighing_areas.js'

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

export const DISCHARGE_PREPARATION_FIXTURES = definitions.map((definition, index) => {
  const sequence = index + 1
  const dischargeId = fixtureUuid(23600000, sequence)
  const shiftId = fixtureUuid(23600001, sequence)
  const productLotId = fixtureUuid(23600002, sequence)
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
          customerId: CUSTOMER_FIXTURE_IDS.atlantic,
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
          truckId: TRUCK_FIXTURE_IDS.available,
          registrationSnapshot: 'AA-101-PF',
          transportCompanyId: TRANSPORT_COMPANY_FIXTURE_IDS.atlantic,
          transportCompanyNameSnapshot: 'Atlantique Transport Routier',
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
          warehouseDoorId: WAREHOUSE_DOOR_FIXTURE_IDS.north,
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
          truckId: TRUCK_FIXTURE_IDS.available,
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
          warehouseDoorId: WAREHOUSE_DOOR_FIXTURE_IDS.north,
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
          weighingAreaId: WEIGHING_AREA_FIXTURE_EXEMPLARS.available.id,
          effectiveFrom: FIXTURE_REFERENCE_DATE,
          effectiveTo: null,
        },
      },
    ],
  }
})

export const DISCHARGE_PREPARATION_FIXTURE_EXEMPLARS = {
  planned: DISCHARGE_PREPARATION_FIXTURES[0],
  active: DISCHARGE_PREPARATION_FIXTURES[1],
  closed: DISCHARGE_PREPARATION_FIXTURES[2],
} as const
