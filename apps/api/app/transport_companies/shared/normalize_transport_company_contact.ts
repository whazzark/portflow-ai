import { isAcceptedPhoneNumber } from '#shared/validators/contact_validator'

import {
  InvalidTransportCompanyContactEmailException,
  InvalidTransportCompanyContactPhoneException,
} from './transport_company_exceptions.ts'

export const MAX_CONTACT_PHONE_LENGTH = 32
export const MAX_CONTACT_EMAIL_LENGTH = 255

export const assertValidContactPhone = (value: string) => {
  const normalized = value.trim()

  if (
    !normalized ||
    normalized.length > MAX_CONTACT_PHONE_LENGTH ||
    !isAcceptedPhoneNumber(normalized)
  ) {
    throw new InvalidTransportCompanyContactPhoneException()
  }

  return normalized
}

export const assertValidContactEmail = (value: string) => {
  const normalized = value.trim()

  // Format validity (FR-009) is Vine's `.email()` rule at the HTTP boundary — the same authority
  // the sibling `name` field defers to for its own format rules. Re-implementing that check here
  // with a second regex risks disagreeing with Vine on an edge case Vine accepts, which would
  // make a request that passed HTTP validation fail anyway with a confusing domain exception.
  if (!normalized || normalized.length > MAX_CONTACT_EMAIL_LENGTH) {
    throw new InvalidTransportCompanyContactEmailException()
  }

  return normalized
}
