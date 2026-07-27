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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import type { SessionUser } from '@/features/auth/context/session-context'
import { isAdministrator } from '@/features/auth/policies/permissions'
import { ThemeToggle } from '@/libraries/theme/theme-toggle'

const NAVIGATION_GROUPS: NavigationGroupType[] = [
  {
    label: 'Monitoring',
    items: [{ label: 'Overview', icon: LayoutDashboardIcon, href: '/' }],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Discharges', icon: ShipIcon },
      { label: 'Rotation validation', icon: ListChecksIcon },
    ],
  },
  {
    label: 'Site references',
    items: [
      { label: 'Customers', icon: ContactIcon, href: '/customers' },
      { label: 'Trucks', icon: TruckIcon },
      { label: 'Checkpoints', icon: MapPinIcon },
      { label: 'Warehouses', icon: WarehouseIcon },
    ],
  },
]

export function AppSidebar({ user }: { user: SessionUser }) {
  const canBrowseUsers = isAdministrator(user)

  return (
    <Sidebar collapsible="icon" aria-label="Application sidebar">
      <SidebarHeader>
        <div className="flex h-10 items-center justify-center px-2 group-data-[collapsible=icon]:px-0">
          <Brand tone="inverse" className="w-32 group-data-[collapsible=icon]:hidden" />
          <Brand
            tone="inverse"
            variant="mark"
            className="hidden group-data-[collapsible=icon]:block"
          />
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <nav aria-label="Primary">
          {NAVIGATION_GROUPS.map((group) => (
            <NavigationGroup key={group.label} group={group} />
          ))}

          {canBrowseUsers && (
            <NavigationGroup
              group={{
                label: 'Administration',
                items: [{ label: 'Users', icon: UsersIcon }],
              }}
            />
          )}
        </nav>
      </SidebarContent>

      <SidebarFooter>
        <ThemeToggle />
        <SidebarSeparator className="mx-0 data-horizontal:w-full" />
        <UserMenu user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
