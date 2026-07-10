import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import User, { USER_ROLES } from '#models/user'

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
  .state('active', (user) => {
    user.accessStatus = 'ACTIVE'
    user.password = 'hashed-password'
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
  .state('reactivated', (user) => {
    user.accessStatus = 'ACTIVE'
    user.reactivatedAt = DateTime.now()
  })
  .build()
