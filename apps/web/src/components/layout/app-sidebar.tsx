import { LayoutDashboardIcon } from 'lucide-react'
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
import { UserMenu } from '@/components/layout/user-menu'
import { ThemeToggle } from '@/libraries/theme/theme-toggle'

export function AppSidebar({ user }: { user: SessionUser }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <span className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary font-mono font-semibold text-sidebar-primary-foreground text-xs">
            PF
          </span>
          <span className="font-semibold group-data-[collapsible=icon]:hidden">Portflow</span>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="Primary">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive render={<a href="/" />} tooltip="Overview">
                    <LayoutDashboardIcon />
                    <span>Overview</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <ThemeToggle />
        <SidebarSeparator className="mx-0 data-horizontal:w-full" />
        <UserMenu user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
