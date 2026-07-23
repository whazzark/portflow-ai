import vine from '@vinejs/vine'

export const nonBlank = vine.createRule(
  (value, _options, field) => {
    if (typeof value === 'string' && value.trim().length === 0) {
      field.report('The {{ field }} field must not be blank', 'nonBlank', field)
    }
  },
  { name: 'nonBlank' },
)
