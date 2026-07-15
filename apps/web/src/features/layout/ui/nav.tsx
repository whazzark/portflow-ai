import type { SessionUser } from '@/features/auth/context/session-context'
import { useLogout } from '@/features/auth/mutations/use-logout'
import { parseApiError } from '@/libraries/tuyau/api-error'

export function Nav({ user }: { user: SessionUser }) {
  const logout = useLogout()

  return (
    <nav aria-label="Primary">
      <span>Portflow</span>
      <p>{user.email}</p>
      <button type="button" onClick={() => logout.mutate({})}>
        Sign out
      </button>
      {logout.isError && <p role="alert">{parseApiError(logout.error).message}</p>}
    </nav>
  )
}
