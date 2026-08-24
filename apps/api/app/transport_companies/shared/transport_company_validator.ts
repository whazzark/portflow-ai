import vine from '@vinejs/vine'
import { nonBlank } from '#site_references/shared/site_reference_validator'

export const createTransportCompanyValidator = vine.create({
  name: vine.string().use(nonBlank()).minLength(1).maxLength(255),
})

export const updateTransportCompanyValidator = vine.create({
  name: vine.string().use(nonBlank()).minLength(1).maxLength(255),
})
