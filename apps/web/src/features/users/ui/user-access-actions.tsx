import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { SheetFooter } from '@/components/ui/sheet'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { formatFullName } from '@/features/users/helpers/name'
import {
  describeUserAccessEffect,
  describeUserAccessRefusal,
  USER_ACCESS_ACTION_LABELS,
  USER_ACCESS_PENDING_LABELS,
  userAccessDialogTitle,
  userAccessFailureTitle,
  userAccessSuccessMessage,
} from '@/features/users/helpers/user-access-copy'
import { useUserMutations } from '@/features/users/mutations/use-user-mutations'
import type { UserDto } from '@/features/users/types'
import { parseApiError } from '@/libraries/tuyau/api-error'

/**
 * The write half of the access record, footer included: a record with no action available renders
 * no footer at all rather than an empty bordered bar, which is only expressible if the same
 * component owns both.
 *
 * Nothing here decides who may deactivate — the API does, and refuses whatever this component would
 * have offered by mistake. What it decides is what to offer.
 *
 * A refusal keeps the dialog open so the administrator reads the reason in place;
 * `event.preventDefault()` on the confirm action is what stops the dialog primitive from closing.
 *
 * With one exception, and it is the commonest refusal: when the reason is that this record moved on
 * — someone else deactivated this user first — the refreshed collection no longer lists them among
 * the active users, `UsersPage` closes the record it can no longer find, and this component
 * unmounts with its dialog before the refusal is even caught. Nothing is lost by that: the reason
 * arrives as a toast, which outlives both, and holding a confirmation open over a record the
 * workbench has just retired would say the opposite of what happened.
 */
export function UserAccessActions({ user }: { user: UserDto }) {
  const [confirming, setConfirming] = useState(false)
  const viewer = useAuthenticatedUser()
  const { deactivate } = useUserMutations()
  const name = formatFullName(user)

  // Three conditions, and the API enforces all three regardless: managing access is the
  // organization admin's responsibility, deactivation is the transition out of active access, and
  // retiring your own access is something another administrator does for you. The last one renders
  // nothing rather than a disabled control — a dead button with no explanation reads as a bug.
  const mayDeactivate =
    viewer.role === 'ORGANIZATION_ADMIN' && user.accessStatus === 'ACTIVE' && user.id !== viewer.id

  if (!mayDeactivate) {
    return null
  }

  const submit = async () => {
    try {
      await deactivate.mutateAsync({ params: { id: user.id } })

      setConfirming(false)
      toast.success(userAccessSuccessMessage('deactivate', name))
    } catch (cause) {
      const error = parseApiError(cause)

      toast.error(userAccessFailureTitle('deactivate', name), {
        description: describeUserAccessRefusal(error.code, error.message),
      })
    }
  }

  return (
    <SheetFooter className="shrink-0 border-t bg-popover sm:flex-row sm:justify-end">
      <Button onClick={() => setConfirming(true)} type="button" variant="destructive">
        {USER_ACCESS_ACTION_LABELS.deactivate}
      </Button>
      <AlertDialog onOpenChange={setConfirming} open={confirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{userAccessDialogTitle('deactivate')}</AlertDialogTitle>
            <AlertDialogDescription>
              {describeUserAccessEffect('deactivate', name)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deactivate.isPending}
              onClick={(event) => {
                event.preventDefault()
                void submit()
              }}
            >
              {deactivate.isPending
                ? USER_ACCESS_PENDING_LABELS.deactivate
                : USER_ACCESS_ACTION_LABELS.deactivate}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SheetFooter>
  )
}
