import { Link, useMatches } from '@tanstack/react-router'
import { Fragment } from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function AuthenticatedHeader() {
  const { isMobile, state } = useSidebar()
  const matches = useMatches({
    select: (routeMatches) =>
      routeMatches.flatMap((match) => {
        const { breadcrumb } = match.staticData

        if (!breadcrumb) {
          return []
        }

        const label = typeof breadcrumb === 'function' ? breadcrumb(match.loaderData) : breadcrumb

        return [{ href: match.pathname, label }]
      }),
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
                        // Only a nested page has a crumb above its own, and its parent owns
                        // the state it was opened from — a list's status and search. Keeping
                        // the search returns the user to that list, not to its defaults.
                        <BreadcrumbLink render={<Link search={true} to={match.href} />}>
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
