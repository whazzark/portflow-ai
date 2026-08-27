import type { UserRole } from '#models/user'
import { fixtureUuid } from './shared.js'

export const USER_FIXTURE_IDS = {
  organizationAdmin: fixtureUuid(23500001, 1),
  operationsAdmin: fixtureUuid(23500001, 2),
  operationsLead: fixtureUuid(23500001, 3),
  observer: fixtureUuid(23500001, 4),
  passwordRenewalObserver: fixtureUuid(23500001, 5),
} as const

export const USER_FIXTURES: Array<{
  id: string
  state: 'active' | 'passwordRenewalRequired'
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
  // The only account in the seeded dataset that carries a password renewal requirement, and the
  // only way the requirement reaches a running system until `#17` or `#32` ships a producer.
  //
  // A fifth user rather than a flag on one of the four above: those seed one account per role and
  // the organization admin is the account developers sign in with, so flagging one would confine an
  // existing role's login and block every unrelated manual flow in the repository. OBSERVER because
  // what this fixture demonstrates is the confinement, not any permission.
  {
    id: USER_FIXTURE_IDS.passwordRenewalObserver,
    state: 'passwordRenewalRequired',
    attributes: {
      firstName: 'Emma',
      lastName: 'Leroy',
      email: 'emma.leroy@portflow.ai',
      role: 'OBSERVER',
    },
  },
]

export const USER_FIXTURE_EXEMPLARS = {
  lifecycleActor: USER_FIXTURES[1],
  responsible: USER_FIXTURES[2],
} as const
