import { useQuery } from '@tanstack/react-query'
import { TuyauError } from '@tuyau/core/client'
import type { Route } from '@tuyau/core/types'
import { createContext, type ReactNode, useContext } from 'react'

import { tuyauQuery } from '@/libraries/tuyau/client'

type SessionUser = Route.Response<'auth.me'>['data']

type Session =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; user: SessionUser }
  | { status: 'error' }

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const meQuery = useQuery(tuyauQuery.auth.me.queryOptions({}))

  let session: Session = { status: 'error' }

  if (meQuery.isPending) {
    session = { status: 'loading' }
  }

  if (meQuery.isSuccess) {
    session = { status: 'authenticated', user: meQuery.data.data }
  }

  if (meQuery.error instanceof TuyauError && meQuery.error.status === 401) {
    session = { status: 'unauthenticated' }
  }

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export function useSession() {
  const session = useContext(SessionContext)

  if (!session) {
    throw new Error('useSession must be used within a SessionProvider')
  }

  return session
}
