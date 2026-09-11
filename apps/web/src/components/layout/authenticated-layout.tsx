import { Outlet } from '@tanstack/react-router'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AuthenticatedHeader } from '@/components/layout/authenticated-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useSession } from '@/features/auth/context/use-session'

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /**
     * A fixed label, or one resolved from the route's loader data for a page that names a record —
     * one discharge, say. The function receives `undefined` while the loader has produced nothing,
     * and when it failed or found no record, so it must always have a label to fall back on.
     */
    breadcrumb?: string | ((loaderData: unknown) => string)
  }
}

export function AuthenticatedLayout() {
  const session = useSession()

  if (session.status !== 'authenticated') {
    return null
  }

  return (
    <SidebarProvider>
      <AppSidebar user={session.user} />
      <SidebarInset>
        <AuthenticatedHeader />
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
