import { createFileRoute } from '@tanstack/react-router'
import { useSession } from '@/features/auth/context/session-context'
import { useLogout } from '@/features/auth/mutations/use-logout'
import { LoginScreen } from '@/features/auth/ui/login-screen'
import { parseApiError } from '@/libraries/tuyau/api-error'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const session = useSession()
  const logout = useLogout()

  if (session.status === 'loading') {
    return null
  }

  if (session.status === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p role="alert">Something went wrong. Please try again.</p>
      </main>
    )
  }

  if (session.status === 'authenticated') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div>
          <p>{session.user.email}</p>
          <button type="button" onClick={() => logout.mutate({})}>
            Sign out
          </button>
          {logout.isError && <p role="alert">{parseApiError(logout.error).message}</p>}
        </div>
      </main>
    )
  }

  return <LoginScreen />
}
