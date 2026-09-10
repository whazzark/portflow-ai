import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SheetFooter } from '@/components/ui/sheet'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
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
 * The write half of the access record, footer included: a record with no action available renders
 * no footer at all rather than an empty bordered bar, which is only expressible if the same
 * component owns both.
 *
 * Nothing here decides who may deactivate — the API does, and refuses whatever this component would
 * have offered by mistake. What it decides is what to offer, and it asks `userAccessActions` so the
 * directory row menu offers exactly the same thing.
 */
export function UserAccessActions({ user }: { user: UserDto }) {
  const [openAction, setOpenAction] = useState<UserAccessAction | null>(null)
  const viewer = useAuthenticatedUser()
  const actions = userAccessActions(viewer, user)

  if (actions.length === 0) {
    return null
  }

  return (
    <SheetFooter className="shrink-0 border-t bg-popover sm:flex-row sm:justify-end">
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
      {openAction && (
        <UserAccessDialog action={openAction} onClose={() => setOpenAction(null)} user={user} />
      )}
    </SheetFooter>
  )
}
