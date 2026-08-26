import User from '#models/user'

import UserRepository, { type CreateUserCommand } from './user_repository.ts'

export default class LucidUserRepository extends UserRepository {
  create(command: CreateUserCommand): Promise<User> {
    return User.create(command)
  }

  findByEmail(email: string): Promise<User | null> {
    return User.query().whereRaw('LOWER(email) = ?', [email.toLowerCase()]).first()
  }

  list(): Promise<User[]> {
    return User.query()
      .preload('invitedBy')
      .preload('activatedBy')
      .preload('cancelledBy')
      .preload('deactivatedBy')
      .preload('reactivatedBy')
      .orderBy('lastName', 'asc')
      .orderBy('firstName', 'asc')
      .orderBy('id', 'asc')
  }

  // No preload: the lifecycle actors are withheld from the viewers this read serves.
  listActive(): Promise<User[]> {
    return User.query()
      .where('accessStatus', 'ACTIVE')
      .orderBy('lastName', 'asc')
      .orderBy('firstName', 'asc')
      .orderBy('id', 'asc')
  }
}
