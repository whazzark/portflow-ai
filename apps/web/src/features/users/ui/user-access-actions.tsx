import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  USER_ACCESS_ACTION_LABELS,
  type UserAccessAction,
} from '@/features/users/helpers/user-access-copy'
import type { UserDto } from '@/features/users/types'
import { ResetPasswordDialog } from '@/features/users/ui/reset-password-confirmation'
import { USER_ACCESS_ACTION_VARIANTS, UserAccessDialog } from '@/features/users/user-access'

type UserAccessActionsProps = {
  /**
   * What `userAccessActions` offers this viewer on this user, asked by the record: it decides from
   * the same answer whether to render a footer at all.
   */
  actions: UserAccessAction[]
  /** `canResetPassword`'s answer, asked by the record for the same reason as `actions`. */
  mayResetPassword: boolean
  className?: string
  user: UserDto
}

/**
 * The access half of the record footer — the buttons and the confirmation they open — laid out by
 * `UserAccessRecord`, which owns the footer, the way `CustomerLifecycleActions` sits in the
 * customer record footer.
 *
 * Nothing here decides who may deactivate — the API does, and refuses whatever this component would
 * have offered by mistake. What to offer is `userAccessActions`'s answer, which the directory row
 * menu asks too.
 *
 * The password reset sits beside those rather than among them, outside `userAccessActions`: it
 * changes a credential rather than an access status, and its confirmation shares none of
 * `user-access-copy`'s sentence shapes. The row menu offers it too, from the same
 * `canResetPassword` answer and with the same `ResetPasswordDialog`.
 */
export function UserAccessActions({
  actions,
  mayResetPassword,
  className,
  user,
}: UserAccessActionsProps) {
  const [openAction, setOpenAction] = useState<UserAccessAction | null>(null)
  const [isResetOpen, setIsResetOpen] = useState(false)

  if (actions.length === 0 && !mayResetPassword) {
    return null
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {/* The button carries the action alone: the record it sits in already names the user. */}
        {mayResetPassword && (
          <Button onClick={() => setIsResetOpen(true)} type="button" variant="outline">
            Reset password
          </Button>
        )}
        {actions.map((action) => (
          <Button
            key={action}
            onClick={() => setOpenAction(action)}
            type="button"
            variant={USER_ACCESS_ACTION_VARIANTS[action]}
          >
            {USER_ACCESS_ACTION_LABELS[action]}
          </Button>
        ))}
      </div>
      {openAction && (
        <UserAccessDialog action={openAction} onClose={() => setOpenAction(null)} user={user} />
      )}
      {isResetOpen && <ResetPasswordDialog onClose={() => setIsResetOpen(false)} user={user} />}
    </div>
  )
}
