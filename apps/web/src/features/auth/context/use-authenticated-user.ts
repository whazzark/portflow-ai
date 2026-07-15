import { useSession } from '@/features/auth/context/use-session'

export function useAuthenticatedUser() {
  const session = useSession()

  if (session.status !== 'authenticated') {
    throw new Error('useAuthenticatedUser must be used within the authenticated route tree')
  }

  return session.user
}
