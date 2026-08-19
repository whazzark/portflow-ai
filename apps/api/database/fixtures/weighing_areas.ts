import {
  archivedLifecycle,
  availableLifecycle,
  fixtureUuid,
  type LifecycleFactoryState,
  reactivatedLifecycle,
} from './shared.js'
import { USER_FIXTURE_IDS } from './users.js'

const values = [
  ['Pont-bascule Nord', 46.1602, -1.2378, 'available'],
  ['Pont-bascule Sud', 46.1528, -1.231, 'reactivated'],
  ['Ancien pont-bascule Chef de Baie', 46.1509, -1.2243, 'archived'],
] as const

export const WEIGHING_AREA_FIXTURES = values.map(([name, latitude, longitude, state], index) => ({
  id: fixtureUuid(23500005, index + 1),
  state: state as LifecycleFactoryState,
  attributes: {
    name,
    latitude,
    longitude,
    ...(state === 'archived'
      ? archivedLifecycle(
          USER_FIXTURE_IDS.operationsAdmin,
          'Historical weighbridge retained for operational records',
        )
      : state === 'reactivated'
        ? reactivatedLifecycle(
            USER_FIXTURE_IDS.operationsAdmin,
            'Weighbridge suspended for calibration',
            'Calibration accepted and weighbridge returned to service',
          )
        : availableLifecycle()),
  },
}))

export const WEIGHING_AREA_FIXTURE_EXEMPLARS = {
  available: WEIGHING_AREA_FIXTURES[0],
  reactivated: WEIGHING_AREA_FIXTURES[1],
  archived: WEIGHING_AREA_FIXTURES[2],
} as const
