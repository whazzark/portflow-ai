import '@testing-library/jest-dom/vitest'

import { cleanup, configure } from '@testing-library/react'
import { toast } from 'sonner'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'

import { server } from './msw/server'

configure({ asyncUtilTimeout: 3_000 })

Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
})

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  toast.dismiss()
  server.resetHandlers()
})
afterAll(() => server.close())
