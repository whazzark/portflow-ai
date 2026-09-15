import { inject } from '@adonisjs/core'

import UserRepository from '#users/shared/repositories/user_repository'

@inject()
export default class ListEligibleShiftResponsiblesUseCase {
  constructor(private userRepository: UserRepository) {}

  handle() {
    return this.userRepository.listEligibleShiftResponsibles()
  }
}
