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
import { formatFullName } from '@/features/users/helpers/name'
import { useUserMutations } from '@/features/users/mutations/use-user-mutations'
import type { UserDto } from '@/features/users/types'
import { parseApiError } from '@/libraries/tuyau/api-error'

/**
 * What each refusal means to the administrator who triggered it. The API's own messages are written
 * for an API consumer; these name the person and the next step.
 *
 * A code absent from this table falls back to the API's message, so a refusal introduced later is
 * still reported rather than swallowed.
 */
function describeRefusal(code: string, user: UserDto, fallback: string) {
  const refusals: Record<string, string> = {
    E_USER_NOT_ACTIVE: `${formatFullName(user)} is no longer active, so their password cannot be reset. Refresh to see their current access status.`,
    E_USER_NOT_FOUND: `${formatFullName(user)} no longer exists. Refresh to see the current users.`,
    E_USER_PASSWORD_RESET_SELF: 'You cannot reset your own password.',
    E_AUTHORIZATION_FAILURE: 'You are not allowed to reset a password.',
    NETWORK_ERROR: fallback,
  }

  return refusals[code] ?? fallback
}

/**
 * The deliberate confirmation in front of the reset, mounted by the record footer and by the row
 * menu alike, so the reset reads the same wherever it was started from. It names the user and states
 * the consequence, because the administrator is acting on somebody else's access and cannot observe
 * the result by using it.
 *
 * Mounted only while open, like `UserAccessDialog`, and for the same reason: the directory lists
 * every user of a view, and an idle row must not carry a mutation observer for an action it could
 * offer.
 *
 * A refusal keeps the dialog open — `event.preventDefault()` on the confirm action is what stops the
 * primitive from closing on click — so the administrator sees what happened and can retry in place.
 */
export function ResetPasswordDialog({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const { resetPassword, refreshUsers } = useUserMutations()

  const submit = async () => {
    try {
      await resetPassword.mutateAsync({ params: { id: user.id } })

      onClose()
      toast.success(
        `${formatFullName(user)} will have to choose a new password before using the application again.`,
      )
    } catch (cause) {
      // A refusal may mean the collection this view was built from has moved on, so it is refreshed
      // on the failure path too, not only on the success path.
      void refreshUsers()

      const error = parseApiError(cause)

      toast.error(`Unable to reset ${formatFullName(user)}'s password`, {
        description: describeRefusal(error.code, user, error.message),
      })
    }
  }

  return (
    <AlertDialog onOpenChange={(open) => !open && onClose()} open={true}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset password</AlertDialogTitle>
          <AlertDialogDescription>
            {formatFullName(user)} will have to choose a new password before using the application
            again. They keep the password they already have to sign in, and every browser that
            remembers them will have to sign in again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={resetPassword.isPending}
            onClick={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            {resetPassword.isPending ? 'Resetting…' : 'Reset password'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
