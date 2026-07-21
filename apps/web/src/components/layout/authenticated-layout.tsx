import { Outlet } from '@tanstack/react-router'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
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
        <div className="flex h-14 items-center border-b px-3 md:hidden">
          <SidebarTrigger className="size-10" />
        </div>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
