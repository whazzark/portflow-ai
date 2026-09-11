import { TuyauError } from '@tuyau/core/client'

export type ApiError = {
  code: string
  message: string
  details?: Array<{ field: string; message: string }>
  meta?: unknown
}

const NETWORK_ERROR: ApiError = {
  code: 'NETWORK_ERROR',
  message: 'Unable to reach the server. Check your connection and try again.',
}

const UNKNOWN_ERROR: ApiError = {
  code: 'UNKNOWN_ERROR',
  message: 'Something went wrong. Please try again.',
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof TuyauError && error.status === 401
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof TuyauError && error.status === 404
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
    return {
      code: response.error.code,
      message: response.error.message,
      details: response.error.details,
      meta: response.error.meta,
    }
  }

  return UNKNOWN_ERROR
}
