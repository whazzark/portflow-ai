import vine from '@vinejs/vine'
import { lifecycleComment, lifecycleIds, nonBlank } from '#shared/validators/lifecycle_validator'

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
  comment: lifecycleComment(),
})

export const reactivateCustomerValidator = vine.create({
  comment: lifecycleComment(),
})

export const archiveCustomersValidator = vine.create({
  ids: lifecycleIds(),
  comment: lifecycleComment(),
})

export const reactivateCustomersValidator = vine.create({
  ids: lifecycleIds(),
  comment: lifecycleComment(),
})
