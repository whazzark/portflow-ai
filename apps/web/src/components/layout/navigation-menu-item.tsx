import { Link, useRouterState } from '@tanstack/react-router'
import type { NavigationItem } from '@/components/layout/navigation-types'
import { Badge } from '@/components/ui/badge'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { classnames } from '@/libraries/shadcn/helpers'

const MENU_BUTTON_CLASS_NAME =
  'h-9 gap-2.5 px-2.5 data-active:font-semibold group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-3!'

export function NavigationMenuItem({ item }: { item: NavigationItem }) {
  const Icon = item.icon
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  if (item.href) {
    // A page nested under an entry, such as one discharge under the discharges list, still
    // belongs to that entry.
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={isActive}
          render={<Link to={item.href} />}
          tooltip={item.label}
          className={MENU_BUTTON_CLASS_NAME}
        >
          {/* The active entry is the one place the sidebar spends the accent. */}
          <Icon className={isActive ? 'text-sidebar-primary' : 'text-muted-foreground'} />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        disabled
        tooltip={`${item.label} — Coming soon`}
        className={classnames(
          MENU_BUTTON_CLASS_NAME,
          'text-muted-foreground disabled:opacity-100 group-data-[collapsible=icon]:disabled:opacity-45',
        )}
      >
        <Icon className="opacity-60" />
        <span className="min-w-0 flex-1 truncate opacity-80">{item.label}</span>
        <Badge
          variant="secondary"
          className="ml-auto h-4.5 rounded-sm bg-sidebar-accent px-1.5 text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden"
        >
          Soon
        </Badge>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
