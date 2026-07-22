import {
  ContactIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  type LucideIcon,
  MapPinIcon,
  ShipIcon,
  TruckIcon,
  UsersIcon,
  WarehouseIcon,
} from 'lucide-react'
import { Brand } from '@/components/brand/brand'
import { UserMenu } from '@/components/layout/user-menu'
import { Badge } from '@/components/ui/badge'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import type { SessionUser } from '@/features/auth/context/session-context'
import { ThemeToggle } from '@/libraries/theme/theme-toggle'

type NavigationItem = {
  label: string
  icon: LucideIcon
  href?: string
}

type NavigationGroup = {
  label: string
  items: NavigationItem[]
}

const NAVIGATION_GROUPS: NavigationGroup[] = [
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
      { label: 'Customers', icon: ContactIcon },
      { label: 'Trucks', icon: TruckIcon },
      { label: 'Checkpoints', icon: MapPinIcon },
      { label: 'Warehouses', icon: WarehouseIcon },
    ],
  },
]

function NavigationMenuItem({ item }: { item: NavigationItem }) {
  const Icon = item.icon

  if (item.href) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton isActive render={<a href={item.href} />} tooltip={item.label}>
          <Icon />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton disabled title={`${item.label} — Coming soon`}>
        <Icon />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <Badge variant="secondary" className="ml-auto group-data-[collapsible=icon]:hidden">
          Coming soon
        </Badge>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function NavigationGroup({ group }: { group: NavigationGroup }) {
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

export function AppSidebar({ user }: { user: SessionUser }) {
  const canBrowseUsers = user.role === 'OPERATIONS_ADMIN' || user.role === 'ORGANIZATION_ADMIN'

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
