import { Outlet } from '@tanstack/react-router'
import type { ComponentType } from 'react'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AuthenticatedHeader } from '@/components/layout/authenticated-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useSession } from '@/features/auth/context/use-session'

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /**
     * A fixed label, or a component rendering the label of a page that names a record — one
     * discharge, say. The component gets the route's params and reads the record from the query
     * cache, so the crumb follows every refetch the page itself shows. It renders while the record
     * is pending, and when it failed or was not found, so it must always have a label to fall back
     * on.
     */
    breadcrumb?: string | ComponentType<{ params: Record<string, string> }>
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
