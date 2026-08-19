import {
  archivedLifecycle,
  availableLifecycle,
  fixtureUuid,
  type LifecycleFactoryState,
  reactivatedLifecycle,
} from './shared.js'
import { USER_FIXTURE_IDS } from './users.js'

const values = [
  ["Môle d'Escale Ouest", 46.16088, -1.23972, 'available'],
  ["Môle d'Escale Est", 46.16052, -1.23565, 'available'],
  ['Anse Saint-Marc 1', 46.15589, -1.23648, 'available'],
  ['Anse Saint-Marc 2', 46.15431, -1.23318, 'available'],
  ['Chef de Baie 1', 46.15163, -1.22958, 'available'],
  ['Chef de Baie 2', 46.14983, -1.22664, 'available'],
  ['Chef de Baie 3', 46.14868, -1.22383, 'archived'],
  ['Quai Lombard Nord', 46.16232, -1.22537, 'available'],
  ['Quai Lombard Sud', 46.16078, -1.22284, 'archived'],
  ['Appontement pétrolier AP00', 46.15669, -1.24291, 'available'],
  ['Bassin à flot 1', 46.15865, -1.2189, 'available'],
  ['Bassin à flot 2', 46.15747, -1.21678, 'reactivated'],
] as const

export const DOCK_FIXTURES = values.map(([name, latitude, longitude, state], index) => ({
  id: fixtureUuid(23500004, index + 1),
  state: state as LifecycleFactoryState,
  attributes: {
    name,
    latitude,
    longitude,
    ...(state === 'archived'
      ? archivedLifecycle(
          USER_FIXTURE_IDS.operationsAdmin,
          'Dock retired from the current operating perimeter',
        )
      : state === 'reactivated'
        ? reactivatedLifecycle(
            USER_FIXTURE_IDS.operationsAdmin,
            'Dock temporarily unavailable during maintenance',
            'Dock returned to operational service',
          )
        : availableLifecycle()),
  },
}))

export const DOCK_FIXTURE_EXEMPLARS = {
  available: DOCK_FIXTURES[0],
  archived: DOCK_FIXTURES[6],
  reactivated: DOCK_FIXTURES[11],
} as const
