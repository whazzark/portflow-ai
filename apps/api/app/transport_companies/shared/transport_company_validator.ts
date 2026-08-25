import vine from '@vinejs/vine'
import { phoneNumber } from '#shared/validators/contact_validator'
import { lifecycleComment, lifecycleIds, nonBlank } from '#shared/validators/lifecycle_validator'

// The phone and email fields are trimmed before their format rules run, unlike `name`: their
// rules (`phoneNumber`, `.email()`) are whitespace-sensitive, so a value entered with surrounding
// spaces must be normalized first or it would be wrongly refused as malformed.
const contactPhoneRule = () => vine.string().trim().use(nonBlank()).use(phoneNumber()).maxLength(32)
const contactEmailRule = () => vine.string().trim().use(nonBlank()).email().maxLength(255)

export const createTransportCompanyValidator = vine.create({
  name: vine.string().use(nonBlank()).minLength(1).maxLength(255),
  contactPhone: contactPhoneRule(),
  contactEmail: contactEmailRule(),
})

export const updateTransportCompanyValidator = vine.create({
  name: vine.string().use(nonBlank()).minLength(1).maxLength(255),
  contactPhone: contactPhoneRule(),
  contactEmail: contactEmailRule(),
})

export const archiveTransportCompanyValidator = vine.create({
  comment: lifecycleComment(),
})

export const archiveTransportCompaniesValidator = vine.create({
  ids: lifecycleIds(),
  comment: lifecycleComment(),
})

export const reactivateTransportCompanyValidator = vine.create({
  comment: lifecycleComment(),
})

export const reactivateTransportCompaniesValidator = vine.create({
  ids: lifecycleIds(),
  comment: lifecycleComment(),
})
