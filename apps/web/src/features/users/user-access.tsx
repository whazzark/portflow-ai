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
import type { SessionUser } from '@/features/auth/context/session-context'
import { formatFullName } from '@/features/users/helpers/name'
import {
  describeUserAccessEffect,
  describeUserAccessRefusal,
  USER_ACCESS_ACTION_LABELS,
  USER_ACCESS_PENDING_LABELS,
  type UserAccessAction,
  userAccessDialogTitle,
  userAccessFailureTitle,
  userAccessSuccessMessage,
} from '@/features/users/helpers/user-access-copy'
import { useUserMutations } from '@/features/users/mutations/use-user-mutations'
import type { UserDto } from '@/features/users/types'
import { parseApiError } from '@/libraries/tuyau/api-error'

export const USER_ACCESS_ACTION_VARIANTS: Record<UserAccessAction, 'default' | 'destructive'> = {
  deactivate: 'destructive',
}

/**
 * Which access actions this user's record offers this viewer — asked by the record footer and by
 * the directory row menu alike, so the two can never disagree about what is available.
 *
 * Three conditions, and the API enforces all three regardless: managing access is the organization
 * admin's responsibility, deactivation is the transition out of active access, and retiring your
 * own access is something another administrator does for you. An action that does not apply is
 * absent rather than disabled — a dead control with no explanation reads as a bug.
 */
export function userAccessActions(viewer: SessionUser, user: UserDto): UserAccessAction[] {
  const mayDeactivate =
    viewer.role === 'ORGANIZATION_ADMIN' && user.accessStatus === 'ACTIVE' && user.id !== viewer.id

  return mayDeactivate ? ['deactivate'] : []
}

/**
 * The confirmation on its own, mounted by the record footer and by the row menu, so an access
 * change reads the same wherever it was started from. It owns the mutation hook and is mounted only
 * while a confirmation is open: the directory lists every user of a view, and an idle row must not
 * carry a mutation observer per action it could offer.
 *
 * A refusal keeps the dialog open so the administrator reads the reason in place;
 * `event.preventDefault()` on the confirm action is what stops the dialog primitive from closing.
 *
 * With one exception, and it is the commonest refusal: when the reason is that this record moved on
 * — someone else deactivated this user first — the refreshed collection no longer lists them among
 * the active users, `UsersPage` closes the record it can no longer find, and the record footer
 * unmounts this dialog with it before the refusal is even caught. Nothing is lost by that: the
 * reason arrives as a toast, which outlives both, and holding a confirmation open over a record the
 * workbench has just retired would say the opposite of what happened. A row menu keeps the dialog
 * either way, because it never depended on the record being open.
 */
export function UserAccessDialog({
  action,
  user,
  onClose,
}: {
  action: UserAccessAction
  user: UserDto
  onClose: () => void
}) {
  const { deactivate } = useUserMutations()
  const name = formatFullName(user)

  const submit = async () => {
    try {
      await deactivate.mutateAsync({ params: { id: user.id } })

      onClose()
      toast.success(userAccessSuccessMessage(action, name))
    } catch (cause) {
      const error = parseApiError(cause)

      toast.error(userAccessFailureTitle(action, name), {
        description: describeUserAccessRefusal(error.code, error.message),
      })
    }
  }

  return (
    <AlertDialog onOpenChange={(open) => !open && onClose()} open={true}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{userAccessDialogTitle(action)}</AlertDialogTitle>
          <AlertDialogDescription>{describeUserAccessEffect(action, name)}</AlertDialogDescription>
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
              ? USER_ACCESS_PENDING_LABELS[action]
              : USER_ACCESS_ACTION_LABELS[action]}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
