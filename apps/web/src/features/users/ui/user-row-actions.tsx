import { EllipsisVerticalIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { formatFullName } from '@/features/users/helpers/name'
import {
  USER_ACCESS_ACTION_LABELS,
  type UserAccessAction,
} from '@/features/users/helpers/user-access-copy'
import type { UserDto } from '@/features/users/types'
import {
  USER_ACCESS_ACTION_VARIANTS,
  UserAccessDialog,
  userAccessActions,
} from '@/features/users/user-access'

/**
 * Per-row access menu, so retiring a user's access does not require opening their record first. It
 * offers the same actions, under the same rules and with the same confirmation, as the record
 * footer — both ask `userAccessActions`, and both mount `UserAccessDialog`.
 *
 * Deliberately not `components/lifecycle/resource-row-actions.tsx`, for the reason
 * `helpers/user-access-copy.ts` is not `lifecycle-copy.ts`: that menu is keyed to the site
 * reference lifecycle, down to the archive/reactivate vocabulary of its labels and the edit action
 * a user record has no slice for. What the two share is the shell — a trigger, a portaled menu, one
 * item per action — and it is small enough that copying it costs less than a shared component with
 * two vocabularies threaded through it. That trade turns when the user record gains its own second
 * and third action.
 */
export function UserRowActions({
  user,
  onView,
}: {
  user: UserDto
  onView?: (userId: string) => void
}) {
  const viewer = useAuthenticatedUser()
  const [openAction, setOpenAction] = useState<UserAccessAction | null>(null)
  const actions = userAccessActions(viewer, user)

  // A menu with nothing in it is not rendered at all, rather than as an empty popup.
  if (onView === undefined && actions.length === 0) {
    return null
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`Actions for ${formatFullName(user)}`}
              className="mr-1 shrink-0"
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <EllipsisVerticalIcon />
          <span className="sr-only">Actions</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onView && <DropdownMenuItem onClick={() => onView(user.id)}>View</DropdownMenuItem>}
          {actions.map((action) => (
            <DropdownMenuItem
              key={action}
              onClick={() => setOpenAction(action)}
              variant={USER_ACCESS_ACTION_VARIANTS[action]}
            >
              {USER_ACCESS_ACTION_LABELS[action]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {openAction && (
        <UserAccessDialog action={openAction} onClose={() => setOpenAction(null)} user={user} />
      )}
    </>
  )
}
