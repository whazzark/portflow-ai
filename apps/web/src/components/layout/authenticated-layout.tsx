import { Link, Outlet, useMatches } from '@tanstack/react-router'
import { Fragment } from 'react'
import { AppSidebar } from '@/components/layout/app-sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSession } from '@/features/auth/context/use-session'

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    breadcrumb?: string
  }
}

function AuthenticatedHeader() {
  const { isMobile, state } = useSidebar()
  const matches = useMatches({
    select: (routeMatches) =>
      routeMatches.flatMap((match) =>
        match.staticData.breadcrumb
          ? [{ href: match.pathname, label: match.staticData.breadcrumb }]
          : [],
      ),
  })
  const toggleLabel = isMobile
    ? 'Open sidebar'
    : state === 'expanded'
      ? 'Collapse sidebar'
      : 'Expand sidebar'

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-3">
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          <SidebarTrigger aria-label={toggleLabel} className="size-10" />
        </TooltipTrigger>
        <TooltipContent side="bottom" hidden={isMobile}>
          {toggleLabel}
        </TooltipContent>
      </Tooltip>

      {matches.length > 0 && (
        <>
          <Separator orientation="vertical" className="self-center! h-4!" />
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap overflow-hidden">
              {matches.map((match, index) => {
                const isCurrentPage = index === matches.length - 1

                return (
                  <Fragment key={match.href}>
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem className="min-w-0">
                      {isCurrentPage ? (
                        <BreadcrumbPage className="truncate">{match.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink render={<Link to={match.href} />}>
                          {match.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </>
      )}
    </header>
  )
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
