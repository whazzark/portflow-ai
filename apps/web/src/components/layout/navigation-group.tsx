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
    <SidebarGroup>
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map((item) => (
            <NavigationMenuItem key={item.label} item={item} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
