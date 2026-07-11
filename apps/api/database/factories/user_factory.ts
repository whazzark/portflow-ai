import hash from '@adonisjs/core/services/hash'
import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import User, { USER_ROLES } from '#models/user'

export const USER_FACTORY_PASSWORD = 'Password!234'

const hashedFactoryPassword = hash.make(USER_FACTORY_PASSWORD)

export const UserFactory = factory
  .define(User, ({ faker }) => {
    return {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email(),
      password: null,
      role: faker.helpers.arrayElement(USER_ROLES),
      accessStatus: 'PENDING' as const,
    }
  })
  .state('active', async (user) => {
    user.accessStatus = 'ACTIVE'
    user.password = await hashedFactoryPassword
    user.activatedAt = DateTime.now()
  })
  .state('deactivated', (user) => {
    user.accessStatus = 'DEACTIVATED'
    user.deactivatedAt = DateTime.now()
  })
  .state('cancelled', (user) => {
    user.accessStatus = 'CANCELLED'
    user.cancelledAt = DateTime.now()
  })
  .state('reactivated', async (user) => {
    user.accessStatus = 'ACTIVE'
    user.password = await hashedFactoryPassword
    user.reactivatedAt = DateTime.now()
  })
  .build()
