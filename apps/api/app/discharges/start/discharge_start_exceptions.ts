import { Exception } from '@adonisjs/core/exceptions'

import type { StartProblem } from '#discharges/start/discharge_start_rules'

/**
 * A start refused for what the discharge's preparation or the site's other active discharges are,
 * not for what the request said: the refusal carries every problem found, and the shift that would
 * have started, so the review can show the same list the check would.
 */
export class DischargeStartRefusedException extends Exception {
  static status = 409
  static code = 'E_DISCHARGE_START_REFUSED'
  static message = 'This discharge cannot start yet'

  readonly meta: { shiftId: string | null; problems: StartProblem[] }

  constructor(meta: { shiftId: string | null; problems: StartProblem[] }) {
    super()
    this.meta = meta
  }
}
