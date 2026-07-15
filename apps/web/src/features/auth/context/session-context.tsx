import { useQuery } from '@tanstack/react-query'
import type { Route } from '@tuyau/core/types'
import { createContext, type ReactNode } from 'react'

import { isUnauthorizedError } from '@/libraries/tuyau/api-error'
import { tuyauQuery } from '@/libraries/tuyau/client'

export type SessionUser = Route.Response<'auth.me'>['data']

export type Session =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: SessionUser }
  | { status: 'error' }

export const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const meQuery = useQuery(tuyauQuery.auth.me.queryOptions({}))

  let session: Session = { status: 'error' }

  if (meQuery.isPending) {
    session = { status: 'loading' }
  }

  if (meQuery.isSuccess) {
    session = { status: 'authenticated', user: meQuery.data.data }
  }

  if (isUnauthorizedError(meQuery.error)) {
    session = { status: 'unauthenticated' }
  }

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}
