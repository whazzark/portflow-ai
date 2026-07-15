import { Outlet } from '@tanstack/react-router'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { Nav } from '@/features/layout/ui/nav'

export function AuthenticatedLayout() {
  const user = useAuthenticatedUser()

  return (
    <>
      <Nav user={user} />
      <main>
        <Outlet />
      </main>
    </>
  )
}
