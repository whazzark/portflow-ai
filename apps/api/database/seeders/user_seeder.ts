import { BaseSeeder } from '@adonisjs/lucid/seeders'

import { UserFactory } from '#database/factories/user_factory'
import User, { type UserRole } from '#models/user'

const DEMO_USERS: Array<{
  firstName: string
  lastName: string
  email: string
  role: UserRole
}> = [
  {
    firstName: 'Claire',
    lastName: 'Martin',
    email: 'claire.martin@portflow.ai',
    role: 'ORGANIZATION_ADMIN',
  },
  {
    firstName: 'Thomas',
    lastName: 'Bernard',
    email: 'thomas.bernard@portflow.ai',
    role: 'OPERATIONS_ADMIN',
  },
  {
    firstName: 'Sophie',
    lastName: 'Dubois',
    email: 'sophie.dubois@portflow.ai',
    role: 'OPERATIONS_LEAD',
  },
  {
    firstName: 'Lucas',
    lastName: 'Moreau',
    email: 'lucas.moreau@portflow.ai',
    role: 'OBSERVER',
  },
]

export default class UserSeeder extends BaseSeeder {
  async run() {
    for (const demoUser of DEMO_USERS) {
      const existingUser = await User.query().whereRaw('LOWER(email) = ?', [demoUser.email]).first()

      if (existingUser) {
        continue
      }

      await UserFactory.apply('active').merge(demoUser).create()
    }
  }
}
