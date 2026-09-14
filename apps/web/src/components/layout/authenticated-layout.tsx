import { useQueryClient } from '@tanstack/react-query'
import { Outlet, useRouter } from '@tanstack/react-router'
import { type ComponentType, useEffect, useRef } from 'react'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AuthenticatedHeader } from '@/components/layout/authenticated-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import type { Session } from '@/features/auth/context/session-context'
import { useSession } from '@/features/auth/context/use-session'
import { resetSession } from '@/features/auth/session/session-cache'
import { tuyauQuery } from '@/libraries/tuyau/client'

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

/**
 * Sends a viewer whose session ended while the page was open to sign-in: they were deactivated, or
 * lost their access in a collision with another administrator (GH-29), and the next `auth.me`
 * answered 401.
 *
 * Not a bare `<Navigate to="/login">`. A failed refetch keeps the previous user in the cache, so
 * `_guest`'s guard, which reads it through `ensureQueryData`, would bounce the viewer straight back
 * here — and `_authenticated`'s would let the stale user through. The session is cleared first and
 * the guards re-run, exactly as a logout does, so the redirect comes from the one place that
 * already decides it.
 *
 * Only when the stale user is still cached, which is exactly the session lost mid-visit. A logout
 * reaches `unauthenticated` too, but it has already cleared the session and re-runs the guards
 * itself; stepping in as well would clear it a second time and cancel the guard's own fetch.
 *
 * Once per loss: clearing the session passes through `loading` and back to `unauthenticated`, which
 * must not start a second departure. Only a session that becomes authenticated again re-arms it.
 */
function useLeaveOnLostSession(status: Session['status']) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const leaving = useRef(false)

  useEffect(() => {
    if (status === 'authenticated') {
      leaving.current = false
      return
    }
    if (status !== 'unauthenticated' || leaving.current) {
      return
    }
    // The exact key `SessionProvider` reads: `getQueryData` does not match by prefix.
    if (queryClient.getQueryData(tuyauQuery.auth.me.queryOptions({}).queryKey) === undefined) {
      return
    }

    leaving.current = true
    void resetSession(queryClient).then(() => router.invalidate())
  }, [status, queryClient, router])
}

export function AuthenticatedLayout() {
  const session = useSession()
  useLeaveOnLostSession(session.status)

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
