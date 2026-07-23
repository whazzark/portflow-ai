import vine from '@vinejs/vine'
import { nonBlank } from '#site_references/shared/site_reference_validator'

export const createCustomerValidator = vine.create({
  code: vine.string().use(nonBlank()).minLength(1).maxLength(255),
  companyName: vine.string().use(nonBlank()).minLength(1).maxLength(255),
})

export const updateCustomerValidator = vine.create(
  vine.object({
    code: vine
      .string()
      .use(nonBlank())
      .minLength(1)
      .maxLength(255)
      .optional()
      .requiredWhen((field) => Object.hasOwn(field.parent, field.name))
      .requiredIfMissing('companyName'),
    companyName: vine
      .string()
      .use(nonBlank())
      .minLength(1)
      .maxLength(255)
      .optional()
      .requiredWhen((field) => Object.hasOwn(field.parent, field.name)),
  }),
)

export const archiveCustomerValidator = vine.create({
  comment: vine.string().nullable().optional(),
})

export const reactivateCustomerValidator = vine.create({
  comment: vine.string().nullable().optional(),
})

export const archiveCustomersValidator = vine.create({
  ids: vine.array(vine.string().uuid()).minLength(1).distinct(),
  comment: vine.string().nullable().optional(),
})

export const reactivateCustomersValidator = vine.create({
  ids: vine.array(vine.string().uuid()).minLength(1).distinct(),
  comment: vine.string().nullable().optional(),
})
