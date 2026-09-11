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
import { mayEditUserIdentity } from '@/features/users/helpers/user-identity'
import { canResetPassword } from '@/features/users/helpers/user-permissions'
import type { UserDto } from '@/features/users/types'
import { ResetPasswordDialog } from '@/features/users/ui/reset-password-confirmation'
import {
  USER_ACCESS_ACTION_VARIANTS,
  UserAccessDialog,
  userAccessActions,
} from '@/features/users/user-access'

/**
 * Per-row menu, so correcting a user, resetting their password, retiring their access, or removing
 * a user who never activated it does not require opening their record first. It offers the same
 * actions, under the same rules and with the same confirmations, as the record footer — both ask
 * `mayEditUserIdentity`, `canResetPassword`, and
 * `userAccessActions`, and both mount `ResetPasswordDialog` and `UserAccessDialog`. View, then Edit,
 * then the password reset, then the access actions: the destructive item stays last, as in the site
 * reference row menus.
 *
 * Deliberately not `components/lifecycle/resource-row-actions.tsx`, for the reason
 * `helpers/user-access-copy.ts` is not `lifecycle-copy.ts`: that menu is keyed to the site
 * reference lifecycle, down to the archive/reactivate vocabulary of its labels. What the two share
 * is the shell — a trigger, a portaled menu, one item per action — and it is small enough that
 * copying it costs less than a shared component with two vocabularies threaded through it. The
 * user record now has three access actions — deactivation, invitation cancellation, and removal —
 * and a pending row offers two of them, which is the point this trade was expected to turn.
 */
export function UserRowActions({
  user,
  onView,
  onEdit,
}: {
  user: UserDto
  onView?: (userId: string) => void
  onEdit?: (userId: string) => void
}) {
  const viewer = useAuthenticatedUser()
  const [openAction, setOpenAction] = useState<UserAccessAction | null>(null)
  const [isResetOpen, setIsResetOpen] = useState(false)
  const actions = userAccessActions(viewer, user)
  const canEdit = onEdit !== undefined && mayEditUserIdentity(viewer, user)
  const mayResetPassword = canResetPassword(viewer, user)

  // A menu with nothing in it is not rendered at all, rather than as an empty popup.
  if (onView === undefined && !canEdit && !mayResetPassword && actions.length === 0) {
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
          {canEdit && <DropdownMenuItem onClick={() => onEdit(user.id)}>Edit</DropdownMenuItem>}
          {mayResetPassword && (
            <DropdownMenuItem onClick={() => setIsResetOpen(true)}>Reset password</DropdownMenuItem>
          )}
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
      {isResetOpen && <ResetPasswordDialog onClose={() => setIsResetOpen(false)} user={user} />}
    </>
  )
}
