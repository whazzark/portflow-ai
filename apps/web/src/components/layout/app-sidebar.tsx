import { LayoutDashboardIcon } from 'lucide-react'
import { Brand } from '@/components/brand/brand'
import { UserMenu } from '@/components/layout/user-menu'
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

export function AppSidebar({ user }: { user: SessionUser }) {
  return (
    <Sidebar collapsible="icon">
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
