import {
  ContactIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MapPinIcon,
  ShipIcon,
  TruckIcon,
  UsersIcon,
  WarehouseIcon,
} from 'lucide-react'
import { Brand } from '@/components/brand/brand'
import { NavigationGroup } from '@/components/layout/navigation-group'
import type { NavigationGroup as NavigationGroupType } from '@/components/layout/navigation-types'
import { UserMenu } from '@/components/layout/user-menu'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from '@/components/ui/sidebar'
import type { SessionUser } from '@/features/auth/context/session-context'
import { isAdministrator } from '@/features/auth/policies/permissions'

const NAVIGATION_GROUPS: NavigationGroupType[] = [
  {
    label: 'Monitoring',
    items: [{ label: 'Overview', icon: LayoutDashboardIcon, href: '/' }],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Discharges', icon: ShipIcon, href: '/discharges' },
      { label: 'Rotation validation', icon: ListChecksIcon },
    ],
  },
  {
    label: 'Site references',
    items: [
      { label: 'Customers', icon: ContactIcon, href: '/customers' },
      { label: 'Transport resources', icon: TruckIcon, href: '/transport-resources' },
      { label: 'Checkpoints', icon: MapPinIcon, href: '/checkpoints' },
      { label: 'Warehouses', icon: WarehouseIcon, href: '/warehouses' },
    ],
  },
]

export function AppSidebar({ user }: { user: SessionUser }) {
  const canBrowseUsers = isAdministrator(user)
  const navigationGroups = NAVIGATION_GROUPS.map((group) =>
    group.label === 'Site references'
      ? {
          ...group,
          items: group.items.filter((item) => item.label !== 'Checkpoints' || canBrowseUsers),
        }
      : group,
  )

  return (
    <Sidebar collapsible="icon" aria-label="Application sidebar">
      <SidebarHeader className="h-16 justify-center py-0 pr-4 pl-4.5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <Brand tone="inverse" className="w-29.5 group-data-[collapsible=icon]:hidden" />
        <Brand
          tone="inverse"
          variant="mark"
          className="hidden size-7.5 object-contain group-data-[collapsible=icon]:block"
        />
      </SidebarHeader>

      <SidebarContent>
        <nav
          aria-label="Primary"
          className="flex flex-col gap-3.5 py-1 group-data-[collapsible=icon]:gap-3 group-data-[collapsible=icon]:py-2"
        >
          {navigationGroups.map((group) => (
            <NavigationGroup key={group.label} group={group} />
          ))}

          {canBrowseUsers && (
            <NavigationGroup
              group={{
                label: 'Administration',
                items: [{ label: 'Users', icon: UsersIcon, href: '/users' }],
              }}
            />
          )}
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border border-t p-2.5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-3">
        <UserMenu user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
