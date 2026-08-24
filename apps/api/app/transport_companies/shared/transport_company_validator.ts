import vine from '@vinejs/vine'
import { lifecycleComment, lifecycleIds, nonBlank } from '#shared/validators/lifecycle_validator'

export const createTransportCompanyValidator = vine.create({
  name: vine.string().use(nonBlank()).minLength(1).maxLength(255),
})

export const updateTransportCompanyValidator = vine.create({
  name: vine.string().use(nonBlank()).minLength(1).maxLength(255),
})

export const archiveTransportCompanyValidator = vine.create({
  comment: lifecycleComment(),
})

export const archiveTransportCompaniesValidator = vine.create({
  ids: lifecycleIds(),
  comment: lifecycleComment(),
})
