import { Link, useRouterState } from '@tanstack/react-router'
import type { NavigationItem } from '@/components/layout/navigation-types'
import { Badge } from '@/components/ui/badge'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

export function NavigationMenuItem({ item }: { item: NavigationItem }) {
  const Icon = item.icon
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  if (item.href) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={pathname === item.href}
          render={<Link to={item.href} />}
          tooltip={item.label}
        >
          <Icon />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton disabled tooltip={`${item.label} — Coming soon`}>
        <Icon />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <Badge variant="secondary" className="ml-auto group-data-[collapsible=icon]:hidden">
          Coming soon
        </Badge>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
