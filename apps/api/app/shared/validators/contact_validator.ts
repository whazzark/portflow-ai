import vine from '@vinejs/vine'

const PHONE_NUMBER_CHARACTERS = /^\+?[\d\s\-.()]+$/
const MIN_PHONE_NUMBER_DIGITS = 6
const MAX_PHONE_NUMBER_DIGITS = 20

export const isAcceptedPhoneNumber = (value: string): boolean => {
  // A `+` past position 0 already fails this character-class test below — `+` is only permitted
  // by the leading `\+?`, and is absent from `[\d\s\-.()]+`, so a second `+` anywhere else, or
  // one not at the start, cannot match. No separate position/count check is needed.
  if (!PHONE_NUMBER_CHARACTERS.test(value)) {
    return false
  }

  const digitCount = (value.match(/\d/g) ?? []).length

  return digitCount >= MIN_PHONE_NUMBER_DIGITS && digitCount <= MAX_PHONE_NUMBER_DIGITS
}

export const phoneNumber = vine.createRule(
  (value, _options, field) => {
    if (typeof value === 'string' && !isAcceptedPhoneNumber(value)) {
      field.report('The {{ field }} field must be a valid phone number', 'phoneNumber', field)
    }
  },
  { name: 'phoneNumber' },
)
