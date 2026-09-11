import { TuyauHTTPError, TuyauNetworkError } from '@tuyau/core/client'
import { expect, test } from 'vitest'

import { isNotFoundError, parseApiError } from '@/libraries/tuyau/api-error'

test('maps a known API error shape to its code and message', () => {
  const error = new TuyauHTTPError(
    // biome-ignore lint/suspicious/noExplicitAny: constructing a minimal fake ky HTTPError for the test
    {} as any,
    { error: { code: 'E_LOGIN_INVALID_CREDENTIALS', message: 'Invalid credentials' } },
  )

  expect(parseApiError(error)).toEqual({
    code: 'E_LOGIN_INVALID_CREDENTIALS',
    message: 'Invalid credentials',
  })
})

test('threads field-level validation details through when present', () => {
  const error = new TuyauHTTPError(
    // biome-ignore lint/suspicious/noExplicitAny: constructing a minimal fake ky HTTPError for the test
    {} as any,
    {
      error: {
        code: 'E_VALIDATION_ERROR',
        message: 'Validation failure',
        details: [{ field: 'email', message: 'The email field must be a valid email address' }],
      },
    },
  )

  expect(parseApiError(error)).toEqual({
    code: 'E_VALIDATION_ERROR',
    message: 'Validation failure',
    details: [{ field: 'email', message: 'The email field must be a valid email address' }],
  })
})

test('maps a network error to a generic connectivity message', () => {
  const error = new TuyauNetworkError(new Error('fetch failed'))

  expect(parseApiError(error)).toEqual({
    code: 'NETWORK_ERROR',
    message: 'Unable to reach the server. Check your connection and try again.',
  })
})

test('maps an unrecognized error shape to a generic message', () => {
  const error = new TuyauHTTPError(
    // biome-ignore lint/suspicious/noExplicitAny: constructing a minimal fake ky HTTPError for the test
    {} as any,
    { unexpected: 'shape' },
  )

  expect(parseApiError(error)).toEqual({
    code: 'UNKNOWN_ERROR',
    message: 'Something went wrong. Please try again.',
  })
})

test('maps a non-Tuyau error to a generic message', () => {
  expect(parseApiError(new Error('boom'))).toEqual({
    code: 'UNKNOWN_ERROR',
    message: 'Something went wrong. Please try again.',
  })
})

function httpError(status: number) {
  return new TuyauHTTPError(
    // biome-ignore lint/suspicious/noExplicitAny: constructing a minimal fake ky HTTPError for the test
    { response: { status } } as any,
    { error: { code: 'E_ANY', message: 'Any' } },
  )
}

test('recognizes a not-found answer and nothing else as not found', () => {
  expect(isNotFoundError(httpError(404))).toBe(true)
  expect(isNotFoundError(httpError(401))).toBe(false)
  expect(isNotFoundError(httpError(500))).toBe(false)
  expect(isNotFoundError(new TuyauNetworkError(new Error('fetch failed')))).toBe(false)
  expect(isNotFoundError(new Error('boom'))).toBe(false)
})
