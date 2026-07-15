import { parseApiError } from '@/libraries/tuyau/api-error'

type FormWithErrorMap = {
  setErrorMap: (errorMap: { onSubmit: { fields: Record<string, string>; form: string } }) => void
}

export function applyValidationError(form: FormWithErrorMap, error: unknown) {
  const apiError = parseApiError(error)

  if (apiError.code !== 'E_VALIDATION_ERROR') {
    return false
  }

  const fields = Object.fromEntries(
    (apiError.details ?? []).map(({ field, message }) => [field, message]),
  )

  form.setErrorMap({
    onSubmit: {
      fields,
      form: apiError.message,
    },
  })

  return true
}
