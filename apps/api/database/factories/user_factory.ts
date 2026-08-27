import hash from '@adonisjs/core/services/hash'
import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import User, { USER_ROLES } from '#models/user'

export const USER_FACTORY_PASSWORD = 'Password!234'

const hashedFactoryPassword = hash.make(USER_FACTORY_PASSWORD)

export const UserFactory = factory
  .define(User, ({ faker }) => {
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()

    return {
      firstName,
      lastName,
      // Suffixed to avoid the case-insensitive unique email index colliding across the finite
      // faker name pool once enough users are created in a run.
      email: faker.internet.email({
        firstName,
        lastName: `${lastName}${faker.string.alphanumeric({ length: 6 })}`,
      }),
      password: null,
      role: faker.helpers.arrayElement(USER_ROLES),
      accessStatus: 'PENDING' as const,
      invitedAt: null,
      invitedByUserId: null,
      activatedAt: null,
      activatedByUserId: null,
      cancelledAt: null,
      cancelledByUserId: null,
      deactivatedAt: null,
      deactivatedByUserId: null,
      reactivatedAt: null,
      reactivatedByUserId: null,
      passwordRenewalRequiredAt: null,
    }
  })
  .state('active', async (user) => {
    user.accessStatus = 'ACTIVE'
    user.password = await hashedFactoryPassword
    user.activatedAt = DateTime.now()
    user.activatedByUserId = null
    user.cancelledAt = null
    user.cancelledByUserId = null
    user.deactivatedAt = null
    user.deactivatedByUserId = null
    user.reactivatedAt = null
    user.reactivatedByUserId = null
  })
  .state('invited', (user) => {
    user.accessStatus = 'PENDING'
    user.invitedAt = DateTime.now()
    user.invitedByUserId = null
  })
  .state('deactivated', (user) => {
    user.accessStatus = 'DEACTIVATED'
    user.deactivatedAt = DateTime.now()
    user.deactivatedByUserId = null
  })
  .state('cancelled', (user) => {
    user.accessStatus = 'CANCELLED'
    user.cancelledAt = DateTime.now()
    user.cancelledByUserId = null
  })
  /**
   * Repeats the `active` state's assignments rather than composing with it: `01_user_seeder.ts`
   * calls `UserFactory.apply(fixture.state)` with a single state name, and widening the seeder to
   * accept a list would change a shared file for one fixture's benefit.
   */
  .state('passwordRenewalRequired', async (user) => {
    user.accessStatus = 'ACTIVE'
    user.password = await hashedFactoryPassword
    user.activatedAt = DateTime.now()
    user.activatedByUserId = null
    user.cancelledAt = null
    user.cancelledByUserId = null
    user.deactivatedAt = null
    user.deactivatedByUserId = null
    user.reactivatedAt = null
    user.reactivatedByUserId = null
    user.passwordRenewalRequiredAt = DateTime.now()
  })
  .state('reactivated', async (user) => {
    user.accessStatus = 'ACTIVE'
    user.password = await hashedFactoryPassword
    user.reactivatedAt = DateTime.now()
    user.reactivatedByUserId = null
  })
  .build()
