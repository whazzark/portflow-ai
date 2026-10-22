import { NavigationMenuItem } from '@/components/layout/navigation-menu-item'
import type { NavigationGroup as NavigationGroupType } from '@/components/layout/navigation-types'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from '@/components/ui/sidebar'

export function NavigationGroup({ group }: { group: NavigationGroupType }) {
  return (
    // Collapsed, the labels give way to a short rule between groups, so the grouping still reads.
    <SidebarGroup className="px-2.5 py-0 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:not-first:before:mb-3 group-data-[collapsible=icon]:not-first:before:h-px group-data-[collapsible=icon]:not-first:before:w-6 group-data-[collapsible=icon]:not-first:before:bg-sidebar-border">
      <SidebarGroupLabel className="h-6.5 px-2.5 text-muted-foreground group-data-[collapsible=icon]:-mt-6.5">
        {group.label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-1">
          {group.items.map((item) => (
            <NavigationMenuItem key={item.label} item={item} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
