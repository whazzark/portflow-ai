import { inject } from '@adonisjs/core'

import {
  DischargeNotFoundException,
  DischargeNotPlannedException,
} from '#discharges/shared/discharge_exceptions'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'

export type ListTruckCandidatesInput = {
  dischargeId: string
}

@inject()
export default class ListTruckCandidatesUseCase {
  constructor(private dischargeRepository: DischargeRepository) {}

  /** Refused like the reservation itself, so the page never offers one the write would refuse. */
  async handle(input: ListTruckCandidatesInput) {
    const read = await this.dischargeRepository.listTruckCandidates(input.dischargeId)

    if (read.kind === 'NOT_FOUND') {
      throw new DischargeNotFoundException()
    }
    if (read.kind === 'NOT_PLANNED') {
      throw new DischargeNotPlannedException()
    }

    return read.candidates
  }
}
