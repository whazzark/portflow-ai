import { parseApiError } from '@/libraries/tuyau/api-error'

type FormWithErrorMap = {
  setErrorMap: (errorMap: { onSubmit: { fields: Record<string, string>; form: string } }) => void
}

/**
 * The API reports an array item as `productLots.1.productName`; TanStack Form names the same field
 * `productLots[1].productName`. Flat paths are left untouched.
 */
export function toFormFieldName(apiField: string) {
  return apiField.replace(/\.(\d+)(?=\.|$)/g, '[$1]')
}

/**
 * Maps an `E_VALIDATION_ERROR` onto the form's fields. When `formFields` lists the fields the form
 * actually renders, a detail on none of them is appended to the form-level error instead, so a
 * refusal the form has no field for is never silently dropped.
 *
 * `toFormField` names the form field an API path refers to, for a form whose values are not shaped
 * like the body; a `null` from it is a refusal on no field of the form.
 */
export function applyValidationError(
  form: FormWithErrorMap,
  error: unknown,
  formFields?: readonly string[],
  toFormField: (apiField: string) => string | null = toFormFieldName,
) {
  const apiError = parseApiError(error)

  if (apiError.code !== 'E_VALIDATION_ERROR') {
    return false
  }

  const known = formFields ? new Set(formFields) : null
  const fields: Record<string, string> = {}
  const unmatched: string[] = []

  for (const { field, message } of apiError.details ?? []) {
    const name = toFormField(field)

    if (name === null || (known && !known.has(name))) {
      unmatched.push(message)
    } else {
      fields[name] = message
    }
  }

  form.setErrorMap({
    onSubmit: {
      fields,
      form: [apiError.message, ...unmatched].join(' '),
    },
  })

  return true
}
