import { Outlet } from '@tanstack/react-router'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useSession } from '@/features/auth/context/use-session'

export function AuthenticatedLayout() {
  const session = useSession()

  if (session.status !== 'authenticated') {
    return null
  }

  return (
    <SidebarProvider>
      <AppSidebar user={session.user} />
      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
