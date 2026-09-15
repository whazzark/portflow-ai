import { errors } from '@vinejs/vine'

export type PreparationIssue = {
  field: string
  rule: string
  message: string
}

/**
 * Refusals of an entered value travel in the validation error shape whatever decided them: the
 * request validator, a rule across several lots or shifts, or a reference found unavailable under
 * lock. The web maps all of them onto fields the same way, and several can be reported at once.
 */
export function throwPreparationIssues(issues: PreparationIssue[]) {
  if (issues.length === 0) {
    return
  }

  throw new errors.E_VALIDATION_ERROR(issues)
}

export function unavailableDockIssue(): PreparationIssue {
  return { field: 'dockId', rule: 'availableDock', message: 'This dock is no longer available' }
}

export function unavailableCustomerIssue(field: string): PreparationIssue {
  return { field, rule: 'availableCustomer', message: 'This customer is no longer available' }
}
