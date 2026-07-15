import { Outlet } from '@tanstack/react-router'
import { useSession } from '@/features/auth/context/use-session'
import { Nav } from '@/features/layout/ui/nav'

export function AuthenticatedLayout() {
  const session = useSession()

  if (session.status !== 'authenticated') {
    return null
  }

  return (
    <>
      <Nav user={session.user} />
      <main>
        <Outlet />
      </main>
    </>
  )
}
