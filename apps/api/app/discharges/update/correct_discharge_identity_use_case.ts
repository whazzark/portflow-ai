import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { DateTime } from 'luxon'

import { DischargeNotFoundException } from '#discharges/shared/discharge_exceptions'
import {
  throwPreparationIssues,
  unavailableDockIssue,
} from '#discharges/shared/discharge_preparation_issues'
import { lockPlannedDischarge } from '#discharges/shared/planned_discharge_guard'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'

export type CorrectDischargeIdentityInput = {
  dischargeId: string
  vesselName: string
  vesselImo: string | null
  vesselComment: string | null
  dockId: string
  expectedStartAt: DateTime
}

const optionalText = (value: string | null) => value?.trim() || null

@inject()
export default class CorrectDischargeIdentityUseCase {
  constructor(
    private preparationRepository: DischargePreparationRepository,
    private dischargeRepository: DischargeRepository,
  ) {}

  /**
   * Corrects a planned discharge's vessel description, dock, and expected start, under the
   * discharge's lock so a start confirmation cannot slip in between the check and the write.
   *
   * A dock is checked only when it changes: the current one is in use by this very discharge, and
   * a reference in use cannot be archived, so re-checking it could only refuse a correction that
   * does not touch it.
   */
  async handle(input: CorrectDischargeIdentityInput) {
    await db.transaction(async (client) => {
      const discharge = await lockPlannedDischarge(
        this.preparationRepository,
        input.dischargeId,
        client,
      )

      if (input.dockId.toLowerCase() !== discharge.dockId.toLowerCase()) {
        const docks = await this.preparationRepository.lockDocks([input.dockId], client)

        if (docks.get(input.dockId.toLowerCase())?.status !== 'AVAILABLE') {
          throwPreparationIssues([unavailableDockIssue()])
        }
      }

      await this.preparationRepository.updateIdentity(
        {
          dischargeId: discharge.id,
          vesselName: input.vesselName.trim(),
          vesselImo: optionalText(input.vesselImo),
          vesselComment: optionalText(input.vesselComment),
          dockId: input.dockId,
          expectedStartAt: input.expectedStartAt,
        },
        client,
      )
    })

    const discharge = await this.dischargeRepository.findDetail(input.dischargeId)
    if (!discharge) {
      throw new DischargeNotFoundException()
    }

    return discharge
  }
}
