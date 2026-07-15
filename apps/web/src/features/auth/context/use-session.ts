import { useContext } from 'react'

import { SessionContext } from '@/features/auth/context/session-context'

export function useSession() {
  const session = useContext(SessionContext)

  if (!session) {
    throw new Error('useSession must be used within a SessionProvider')
  }

  return session
}
