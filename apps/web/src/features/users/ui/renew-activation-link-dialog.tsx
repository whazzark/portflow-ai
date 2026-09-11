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
import type { UserAccessStatus, UserDto } from '@/features/users/types'
import { usePresentActivationLink } from '@/features/users/ui/issued-activation-link'
import { type ApiError, parseApiError } from '@/libraries/tuyau/api-error'

/**
 * What to do instead, by the access status the user turned out to hold. The renewal is refused for
 * each of them, and the refusal only helps if it names the action that does apply.
 */
const INSTEAD_OF_RENEWAL: Record<Exclude<UserAccessStatus, 'PENDING'>, (name: string) => string> = {
  ACTIVE: (name) =>
    `${name} has already activated their access. Reset their password if their credential needs replacing.`,
  DEACTIVATED: (name) => `${name}'s access was deactivated. Reactivate it instead.`,
  CANCELLED: (name) => `${name}'s invitation was cancelled. Restore it instead.`,
}

/**
 * What each refusal means to the administrator who triggered it, in the second person and naming the
 * user. A code absent from here falls back to the API's own message, so a refusal introduced later is
 * still reported rather than swallowed — and a network failure already carries a message that says
 * to try again.
 */
function describeRenewalRefusal(error: ApiError, name: string) {
  if (error.code === 'E_USER_NOT_PENDING') {
    const accessStatus = (error.meta as { accessStatus?: string } | undefined)?.accessStatus
    const instead = INSTEAD_OF_RENEWAL[accessStatus as keyof typeof INSTEAD_OF_RENEWAL]

    return instead ? instead(name) : error.message
  }

  const refusals: Record<string, string> = {
    E_USER_NOT_FOUND: `${name} no longer exists. Refresh to see the current users.`,
    E_AUTHORIZATION_FAILURE: 'You are not allowed to renew an activation link.',
  }

  return refusals[error.code] ?? error.message
}

/**
 * The renewal, from confirmation to the link it hands out, mounted by the record footer and by the
 * row menu alike so it reads the same wherever it was started from — and mounted only while open,
 * like `ResetPasswordDialog`, so an idle row carries no mutation observer.
 *
 * It confirms, and hands the issued link to the page (`usePresentActivationLink`), which presents it
 * once and forgets it on acknowledgement. The link does not stay here: this dialog lives inside a
 * record or a row, and either can disappear under the outcome — a Back in the browser closes the
 * record — while the previous link is already dead.
 *
 * Once submitted, the confirmation cannot be dismissed until the server answers: the renewal may
 * already have retired the previous link, and leaving would discard the only one that works.
 *
 * A refusal keeps the confirmation open — `event.preventDefault()` on the confirm action is what
 * stops the primitive from closing on click — so the administrator reads the reason and can retry in
 * place. When the refusal is that the user stopped being pending, the refreshed collection drops them
 * from the pending view and an open record closes, taking this dialog with it; the toast outlives
 * both, as `UserAccessDialog` documents.
 */
export function RenewActivationLinkDialog({
  user,
  onClose,
}: {
  user: UserDto
  onClose: () => void
}) {
  const { renewActivationLink } = useUserMutations()
  const presentActivationLink = usePresentActivationLink()
  const name = formatFullName(user)

  const submit = async () => {
    try {
      const result = await renewActivationLink.mutateAsync({ params: { id: user.id } })

      presentActivationLink({ user: result.data.user, activationLink: result.data.activationLink })
      onClose()
    } catch (cause) {
      toast.error(`Unable to renew ${name}'s activation link`, {
        description: describeRenewalRefusal(parseApiError(cause), name),
      })
    }
  }

  return (
    <AlertDialog
      onOpenChange={(open) => !open && !renewActivationLink.isPending && onClose()}
      open={true}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Renew activation link</AlertDialogTitle>
          <AlertDialogDescription>
            Any activation link already handed out to {name} will stop working. A new one will be
            shown once, for you to pass on.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={renewActivationLink.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={renewActivationLink.isPending}
            onClick={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            {renewActivationLink.isPending ? 'Renewing…' : 'Renew'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
