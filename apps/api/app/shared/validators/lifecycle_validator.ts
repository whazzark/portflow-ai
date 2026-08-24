import vine from '@vinejs/vine'

export const nonBlank = vine.createRule(
  (value, _options, field) => {
    if (typeof value === 'string' && value.trim().length === 0) {
      field.report('The {{ field }} field must not be blank', 'nonBlank', field)
    }
  },
  { name: 'nonBlank' },
)

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

export const lifecycleComment = () => vine.string().trim().maxLength(1000).nullable().optional()
export const lifecycleIds = () =>
  vine.array(vine.string().uuid().toLowerCase()).minLength(1).use(distinctUuids())
