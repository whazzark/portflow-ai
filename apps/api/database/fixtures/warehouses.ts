import {
  archivedLifecycle,
  availableLifecycle,
  fixtureUuid,
  type LifecycleFactoryState,
  reactivatedLifecycle,
} from './shared.js'
import { USER_FIXTURE_IDS } from './users.js'

const values = [
  [
    'SICA Atlantique - Silos céréaliers',
    'available',
    [
      [46.1603461, -1.2289286],
      [46.1605988, -1.2284251],
      [46.1601449, -1.2279454],
      [46.159887, -1.2284485],
      [46.1600924, -1.2286602],
      [46.1602171, -1.2288759],
    ],
  ],
  [
    'Socomac - Entrepôt céréalier',
    'available',
    [
      [46.1551511, -1.2223178],
      [46.1545061, -1.2235452],
      [46.1541982, -1.2232383],
      [46.1548286, -1.221958],
    ],
  ],
  [
    'Froid Littoral - Entrepôts frigorifiques',
    'available',
    [
      [46.154863, -1.219506],
      [46.154335, -1.220558],
      [46.153971, -1.220178],
      [46.154495, -1.219124],
    ],
  ],
  [
    'SDLP - Dépôt de La Pallice',
    'available',
    [
      [46.159936, -1.24],
      [46.1599036, -1.239478],
      [46.160716, -1.239313],
      [46.160764, -1.239841],
      [46.160248, -1.23994],
    ],
  ],
  [
    'Ancien entrepôt Chef de Baie',
    'archived',
    [
      [46.150477, -1.223374],
      [46.150616, -1.222687],
      [46.150859, -1.222843],
      [46.151113, -1.22341],
      [46.150945, -1.223724],
      [46.150526, -1.223461],
    ],
  ],
  [
    'Ancien dépôt pétrolier',
    'archived',
    [
      [46.1513461, -1.229668],
      [46.1515376, -1.2293636],
      [46.1514021, -1.2291859],
      [46.1511319, -1.229068],
      [46.1510455, -1.2292052],
      [46.1512333, -1.2294514],
    ],
  ],
  [
    'Atlantique Logistique - Hangar 7',
    'reactivated',
    [
      [46.1539637, -1.2212914],
      [46.1533187, -1.2225188],
      [46.1530108, -1.2222119],
      [46.1536412, -1.2209316],
    ],
  ],
  [
    'Port Atlantique - Magasin sous douane',
    'available',
    [
      [46.155421, -1.220314],
      [46.154899, -1.221363],
      [46.154532, -1.220986],
      [46.155056, -1.219928],
    ],
  ],
  [
    'Ancien hangar de Chef de Baie',
    'archived',
    [
      [46.150564, -1.221884],
      [46.150439, -1.221807],
      [46.150542, -1.221467],
      [46.150667, -1.221545],
    ],
  ],
] as const

export const WAREHOUSE_FIXTURES = values.map(([name, state, points], index) => ({
  id: fixtureUuid(23500006, index + 1),
  state: state as LifecycleFactoryState,
  attributes: {
    name,
    ...(state === 'archived'
      ? archivedLifecycle(
          USER_FIXTURE_IDS.operationsAdmin,
          'Warehouse retired from the current storage perimeter',
        )
      : state === 'reactivated'
        ? reactivatedLifecycle(
            USER_FIXTURE_IDS.operationsAdmin,
            'Warehouse suspended during structural maintenance',
            'Warehouse returned to operational storage service',
          )
        : availableLifecycle()),
  },
  footprint: points.map(([latitude, longitude], position) => ({ position, latitude, longitude })),
}))

export const WAREHOUSE_FIXTURE_IDS = {
  sica: WAREHOUSE_FIXTURES[0].id,
  socomac: WAREHOUSE_FIXTURES[1].id,
  froid: WAREHOUSE_FIXTURES[2].id,
  sdlp: WAREHOUSE_FIXTURES[3].id,
  ancien: WAREHOUSE_FIXTURES[4].id,
  hangar7: WAREHOUSE_FIXTURES[6].id,
  douane: WAREHOUSE_FIXTURES[7].id,
  ancienHangar: WAREHOUSE_FIXTURES[8].id,
} as const
export const WAREHOUSE_FIXTURE_EXEMPLARS = {
  available: WAREHOUSE_FIXTURES[0],
  archived: WAREHOUSE_FIXTURES[4],
  reactivated: WAREHOUSE_FIXTURES[6],
} as const
