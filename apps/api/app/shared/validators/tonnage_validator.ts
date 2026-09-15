import vine from '@vinejs/vine'

/**
 * A tonnage crosses the wire as a string, so the NUMERIC(12, 3) column receives exactly what was
 * typed: a JSON number would already have gone through binary floating point, and lots are summed
 * into an expected tonnage where that drift would show. Nine whole digits and three decimals is
 * the column's precision.
 */
export const TONNAGE_PATTERN = /^\d{1,9}(\.\d{1,3})?$/

const strictlyPositive = vine.createRule(
  (value, _options, field) => {
    if (typeof value === 'string' && /^[0.]+$/.test(value)) {
      field.report('The {{ field }} field must be greater than 0', 'strictlyPositive', field)
    }
  },
  { name: 'strictlyPositive' },
)

export const tonnageString = () => vine.string().regex(TONNAGE_PATTERN).use(strictlyPositive())
