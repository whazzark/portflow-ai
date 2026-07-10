import User from '#models/user'

import UserRepository, { type CreateUserCommand } from './user_repository.ts'

export default class LucidUserRepository extends UserRepository {
  create(command: CreateUserCommand): Promise<User> {
    return User.create(command)
  }

  findByEmail(email: string): Promise<User | null> {
    return User.findBy('email', email)
  }
}
