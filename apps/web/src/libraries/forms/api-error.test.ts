import { TuyauHTTPError } from '@tuyau/core/client'
import { expect, test, vi } from 'vitest'

import { applyValidationError } from '@/libraries/forms/api-error'

test('maps a validation error to a form error and matching field errors', () => {
  const setErrorMap = vi.fn()
  const error = new TuyauHTTPError(
    // biome-ignore lint/suspicious/noExplicitAny: constructing a minimal fake ky HTTPError for the test
    {} as any,
    {
      error: {
        code: 'E_VALIDATION_ERROR',
        details: [{ field: 'email', message: 'Email is already in use.' }],
        message: 'Validation failure',
      },
    },
  )

  expect(applyValidationError({ setErrorMap }, error)).toBe(true)

  expect(setErrorMap).toHaveBeenCalledWith({
    onSubmit: {
      fields: { email: 'Email is already in use.' },
      form: 'Validation failure',
    },
  })
})

test('does not apply a non-validation error to the form', () => {
  const setErrorMap = vi.fn()

  const error = new TuyauHTTPError(
    // biome-ignore lint/suspicious/noExplicitAny: constructing a minimal fake ky HTTPError for the test
    {} as any,
    { error: { code: 'E_LOGIN_INVALID_CREDENTIALS', message: 'Invalid credentials' } },
  )

  expect(applyValidationError({ setErrorMap }, error)).toBe(false)
  expect(setErrorMap).not.toHaveBeenCalled()
})
