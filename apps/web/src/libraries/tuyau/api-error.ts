import { TuyauError } from '@tuyau/core/client'

export type ApiError = {
  code: string
  message: string
}

const NETWORK_ERROR: ApiError = {
  code: 'NETWORK_ERROR',
  message: 'Unable to reach the server. Check your connection and try again.',
}

const UNKNOWN_ERROR: ApiError = {
  code: 'UNKNOWN_ERROR',
  message: 'Something went wrong. Please try again.',
}

export function parseApiError(error: unknown): ApiError {
  if (!(error instanceof TuyauError)) {
    return UNKNOWN_ERROR
  }

  if (error.kind === 'network') {
    return NETWORK_ERROR
  }

  const response = error.response as { error?: Partial<ApiError> } | undefined

  if (response?.error?.code && response.error.message) {
    return { code: response.error.code, message: response.error.message }
  }

  return UNKNOWN_ERROR
}
