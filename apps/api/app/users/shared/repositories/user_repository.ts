import type { DateTime } from 'luxon'

import type User from '#models/user'
import type { UserRole } from '#models/user'

export type CreateUserCommand = {
  firstName: string
  lastName: string
  email: string
  role: UserRole
  invitedAt?: DateTime | null
  invitedByUserId?: string | null
}

export default abstract class UserRepository {
  abstract create(command: CreateUserCommand): Promise<User>
  abstract findByEmail(email: string): Promise<User | null>
}
