import { randomUUID } from 'node:crypto'

import { inject } from '@adonisjs/core'
import hash from '@adonisjs/core/services/hash'

import UserRepository from '#users/shared/repositories/user_repository'

import InvalidCredentialsException from './invalid_credentials_exception.ts'

export type LoginUserInput = {
  email: string
  password: string
}

/**
 * Verified even when no user or password exists, so a lookup miss takes as
 * long as a genuine wrong-password attempt and cannot be timed apart.
 */
const dummyPasswordHash = hash.make(randomUUID())

@inject()
export default class LoginUserUseCase {
  constructor(private userRepository: UserRepository) {}

  async handle(input: LoginUserInput) {
    const email = input.email.trim()
    const user = await this.userRepository.findByEmail(email)

    const isValidPassword = await hash.verify(
      user?.password ?? (await dummyPasswordHash),
      input.password,
    )

    if (!user || !isValidPassword || user.accessStatus !== 'ACTIVE') {
      throw new InvalidCredentialsException()
    }

    return user
  }
}
