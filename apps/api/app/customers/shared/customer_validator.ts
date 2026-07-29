import vine from '@vinejs/vine'
import { nonBlank } from '#site_references/shared/site_reference_validator'

const distinctUuids = vine.createRule(
  (value, _options, field) => {
    if (!Array.isArray(value)) {
      return
    }

    const normalized = value.map((id) => (typeof id === 'string' ? id.toLowerCase() : String(id)))
    if (new Set(normalized).size !== normalized.length) {
      field.report('The {{ field }} field has duplicate values', 'distinct', field)
    }
  },
  { name: 'distinctUuids' },
)

const lifecycleComment = () => vine.string().trim().maxLength(1000).nullable().optional()
const lifecycleIds = () =>
  vine.array(vine.string().uuid().toLowerCase()).minLength(1).use(distinctUuids())

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
