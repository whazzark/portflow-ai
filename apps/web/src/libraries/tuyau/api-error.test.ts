import { TuyauHTTPError, TuyauNetworkError } from '@tuyau/core/client'
import { expect, test } from 'vitest'

import { parseApiError } from '@/libraries/tuyau/api-error'

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
