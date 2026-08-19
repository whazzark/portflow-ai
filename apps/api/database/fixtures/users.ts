import type { UserRole } from '#models/user'
import { fixtureUuid } from './shared.js'

export const USER_FIXTURE_IDS = {
  organizationAdmin: fixtureUuid(23500001, 1),
  operationsAdmin: fixtureUuid(23500001, 2),
  operationsLead: fixtureUuid(23500001, 3),
  observer: fixtureUuid(23500001, 4),
} as const

export const USER_FIXTURES: Array<{
  id: string
  state: 'active'
  attributes: { firstName: string; lastName: string; email: string; role: UserRole }
}> = [
  {
    id: USER_FIXTURE_IDS.organizationAdmin,
    state: 'active',
    attributes: {
      firstName: 'Claire',
      lastName: 'Martin',
      email: 'claire.martin@portflow.ai',
      role: 'ORGANIZATION_ADMIN',
    },
  },
  {
    id: USER_FIXTURE_IDS.operationsAdmin,
    state: 'active',
    attributes: {
      firstName: 'Thomas',
      lastName: 'Bernard',
      email: 'thomas.bernard@portflow.ai',
      role: 'OPERATIONS_ADMIN',
    },
  },
  {
    id: USER_FIXTURE_IDS.operationsLead,
    state: 'active',
    attributes: {
      firstName: 'Sophie',
      lastName: 'Dubois',
      email: 'sophie.dubois@portflow.ai',
      role: 'OPERATIONS_LEAD',
    },
  },
  {
    id: USER_FIXTURE_IDS.observer,
    state: 'active',
    attributes: {
      firstName: 'Lucas',
      lastName: 'Moreau',
      email: 'lucas.moreau@portflow.ai',
      role: 'OBSERVER',
    },
  },
]

export const USER_FIXTURE_EXEMPLARS = {
  lifecycleActor: USER_FIXTURES[1],
  responsible: USER_FIXTURES[2],
} as const
