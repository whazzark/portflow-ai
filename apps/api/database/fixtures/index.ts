import { CUSTOMER_FIXTURE_EXEMPLARS } from './customers.js'
import { DOCK_FIXTURE_EXEMPLARS } from './docks.js'
import { TRANSPORT_COMPANY_FIXTURE_EXEMPLARS } from './transport_companies.js'
import { TRUCK_FIXTURE_EXEMPLARS } from './trucks.js'
import { USER_FIXTURE_EXEMPLARS } from './users.js'
import { WAREHOUSE_DOOR_FIXTURE_EXEMPLARS } from './warehouse_doors.js'
import { WAREHOUSE_FIXTURE_EXEMPLARS } from './warehouses.js'
import { WEIGHING_AREA_FIXTURE_EXEMPLARS } from './weighing_areas.js'

export const FIXTURE_LIFECYCLE_ACTOR_EMAIL = USER_FIXTURE_EXEMPLARS.lifecycleActor.attributes.email
export const FIXTURE_LIFECYCLE_TIMESTAMPS = {
  archivedAt: '2024-10-15T10:00:00.000Z',
  reactivatedAt: '2024-12-15T10:00:00.000Z',
  archivedOnlyAt: '2024-11-15T10:00:00.000Z',
} as const

export const MANAGED_FIXTURE_EXEMPLARS = {
  customers: {
    available: CUSTOMER_FIXTURE_EXEMPLARS.available.attributes.code,
    archived: CUSTOMER_FIXTURE_EXEMPLARS.archived.attributes.code,
    reactivated: CUSTOMER_FIXTURE_EXEMPLARS.reactivated.attributes.code,
  },
  docks: {
    available: DOCK_FIXTURE_EXEMPLARS.available.attributes.name,
    archived: DOCK_FIXTURE_EXEMPLARS.archived.attributes.name,
    reactivated: DOCK_FIXTURE_EXEMPLARS.reactivated.attributes.name,
  },
  weighingAreas: {
    available: WEIGHING_AREA_FIXTURE_EXEMPLARS.available.attributes.name,
    archived: WEIGHING_AREA_FIXTURE_EXEMPLARS.archived.attributes.name,
    reactivated: WEIGHING_AREA_FIXTURE_EXEMPLARS.reactivated.attributes.name,
  },
  warehouses: {
    available: WAREHOUSE_FIXTURE_EXEMPLARS.available.attributes.name,
    archived: WAREHOUSE_FIXTURE_EXEMPLARS.archived.attributes.name,
    reactivated: WAREHOUSE_FIXTURE_EXEMPLARS.reactivated.attributes.name,
  },
  warehouseDoors: {
    available: {
      warehouse: WAREHOUSE_FIXTURE_EXEMPLARS.available.attributes.name,
      name: WAREHOUSE_DOOR_FIXTURE_EXEMPLARS.available.attributes.name,
    },
    archived: {
      warehouse: WAREHOUSE_FIXTURE_EXEMPLARS.available.attributes.name,
      name: WAREHOUSE_DOOR_FIXTURE_EXEMPLARS.archived.attributes.name,
    },
    reactivated: {
      warehouse: WAREHOUSE_FIXTURE_EXEMPLARS.reactivated.attributes.name,
      name: WAREHOUSE_DOOR_FIXTURE_EXEMPLARS.reactivated.attributes.name,
    },
  },
  transportCompanies: {
    available: TRANSPORT_COMPANY_FIXTURE_EXEMPLARS.available.attributes.name,
    archived: TRANSPORT_COMPANY_FIXTURE_EXEMPLARS.archived.attributes.name,
    reactivated: TRANSPORT_COMPANY_FIXTURE_EXEMPLARS.reactivated.attributes.name,
  },
  trucks: {
    available: TRUCK_FIXTURE_EXEMPLARS.available.attributes.registration,
    archived: TRUCK_FIXTURE_EXEMPLARS.archived.attributes.registration,
    reactivated: TRUCK_FIXTURE_EXEMPLARS.reactivated.attributes.registration,
  },
} as const
