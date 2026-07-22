import { ChevronUpIcon, LogOutIcon, UserRoundIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { SessionUser } from '@/features/auth/context/session-context'
import { useLogout } from '@/features/auth/mutations/use-logout'
import { LogOutConfirmation } from '@/features/auth/ui/log-out-confirmation'
import { formatFullName, getInitials } from '@/features/users/helpers/name'
import { parseApiError } from '@/libraries/tuyau/api-error'

export function UserMenu({ user }: { user: SessionUser }) {
  const { isMobile, state } = useSidebar()
  const logout = useLogout()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false)
  const fullName = formatFullName(user)
  const initials = getInitials(user)

  function openLogoutConfirmation() {
    logout.reset()
    window.setTimeout(() => setIsConfirmationOpen(true), 0)
  }

  function handleConfirmationOpenChange(open: boolean) {
    if (logout.isPending) {
      return
    }

    setIsConfirmationOpen(open)

    if (!open) {
      logout.reset()
    }
  }

  function confirmLogout() {
    logout.mutate(
      {},
      {
        onError: (error) => {
          toast.error('Unable to log out', { description: parseApiError(error).message })
        },
      },
    )
  }

  return (
    <>
      <SidebarMenu className="min-w-0 flex-1 group-data-[collapsible=icon]:flex-none">
        <SidebarMenuItem>
          <DropdownMenu modal={false} open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
            <Tooltip>
              <TooltipTrigger render={<span className="block w-full" />}>
                <DropdownMenuTrigger
                  aria-label={`Open user menu for ${fullName}`}
                  render={<SidebarMenuButton size="lg" />}
                >
                  <Avatar>
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="block truncate font-medium">{fullName}</span>
                    <span className="block truncate text-sidebar-foreground/70 text-xs">
                      {user.email}
                    </span>
                  </span>
                  <ChevronUpIcon className="ml-auto group-data-[collapsible=icon]:hidden" />
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right" hidden={state !== 'collapsed' || isMobile}>
                {fullName}
              </TooltipContent>
            </Tooltip>

            {isUserMenuOpen && (
              <DropdownMenuContent
                align="end"
                className="min-w-56"
                side={isMobile ? 'top' : 'right'}
                sideOffset={8}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex items-center gap-2 p-2">
                    <Avatar size="lg" aria-hidden="true">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-foreground text-sm">{fullName}</span>
                      <span className="truncate font-normal">{user.email}</span>
                    </span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuItem disabled>
                    <UserRoundIcon />
                    <span>Profile</span>
                    <Badge className="ml-auto" variant="secondary">
                      Coming soon
                    </Badge>
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuItem closeOnClick={false} onClick={openLogoutConfirmation}>
                    <LogOutIcon />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            )}
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <LogOutConfirmation
        isPending={logout.isPending}
        onConfirm={confirmLogout}
        onOpenChange={handleConfirmationOpenChange}
        open={isConfirmationOpen}
      />
    </>
  )
}
