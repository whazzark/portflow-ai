import {
  archivedLifecycle,
  availableLifecycle,
  fixtureUuid,
  type LifecycleFactoryState,
  reactivatedLifecycle,
} from './shared.js'
import { USER_FIXTURE_IDS } from './users.js'
import { WAREHOUSE_FIXTURE_IDS } from './warehouses.js'

const values = [
  [WAREHOUSE_FIXTURE_IDS.sica, 'Porte Nord', 46.16045, -1.22855, 'available'],
  [WAREHOUSE_FIXTURE_IDS.sica, 'Porte Historique', 46.16002, -1.22845, 'archived'],
  [WAREHOUSE_FIXTURE_IDS.socomac, 'Porte Quai', 46.1547, -1.2228, 'available'],
  [WAREHOUSE_FIXTURE_IDS.ancien, 'Porte Ancienne', 46.1507, -1.2231, 'archived'],
  [WAREHOUSE_FIXTURE_IDS.froid, 'Porte Réfrigérée Est', 46.15455, -1.2197, 'available'],
  [WAREHOUSE_FIXTURE_IDS.froid, 'Porte Réfrigérée Ouest', 46.15415, -1.22015, 'archived'],
  [WAREHOUSE_FIXTURE_IDS.sdlp, 'Porte Camions', 46.16035, -1.2396, 'available'],
  [WAREHOUSE_FIXTURE_IDS.hangar7, 'Porte Principale', 46.15365, -1.22135, 'available'],
  [WAREHOUSE_FIXTURE_IDS.hangar7, 'Porte de Service', 46.1533, -1.2222, 'reactivated'],
  [WAREHOUSE_FIXTURE_IDS.douane, 'Porte Douane', 46.1552, -1.2205, 'available'],
  [WAREHOUSE_FIXTURE_IDS.douane, 'Porte Quai Sud', 46.1548, -1.2211, 'archived'],
  [WAREHOUSE_FIXTURE_IDS.ancienHangar, 'Porte condamnée', 46.15055, -1.22165, 'archived'],
] as const

export const WAREHOUSE_DOOR_FIXTURES = values.map(
  ([warehouseId, name, latitude, longitude, state], index) => ({
    id: fixtureUuid(23500007, index + 1),
    state: state as LifecycleFactoryState,
    attributes: {
      warehouseId,
      name,
      latitude,
      longitude,
      ...(state === 'archived'
        ? archivedLifecycle(USER_FIXTURE_IDS.operationsAdmin, 'Door retired from unloading service')
        : state === 'reactivated'
          ? reactivatedLifecycle(
              USER_FIXTURE_IDS.operationsAdmin,
              'Door suspended during access repairs',
              'Door returned to unloading service',
            )
          : availableLifecycle()),
    },
  }),
)

export const WAREHOUSE_DOOR_FIXTURE_IDS = { north: WAREHOUSE_DOOR_FIXTURES[0].id } as const
export const WAREHOUSE_DOOR_FIXTURE_EXEMPLARS = {
  available: WAREHOUSE_DOOR_FIXTURES[0],
  archived: WAREHOUSE_DOOR_FIXTURES[1],
  reactivated: WAREHOUSE_DOOR_FIXTURES[8],
} as const
