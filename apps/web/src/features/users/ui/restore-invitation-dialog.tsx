import { useId, useState } from 'react'
import { toast } from 'sonner'

import {
  LIFECYCLE_COMMENT_DESCRIPTION,
  LIFECYCLE_COMMENT_LABEL,
} from '@/components/lifecycle/lifecycle-copy'
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { formatFullName } from '@/features/users/helpers/name'
import { useUserMutations } from '@/features/users/mutations/use-user-mutations'
import type { UserAccessStatus, UserDto } from '@/features/users/types'
import { usePresentActivationLink } from '@/features/users/ui/issued-activation-link'
import { type ApiError, parseApiError } from '@/libraries/tuyau/api-error'

/**
 * What to do instead, by the access status the user turned out to hold. The restoration is refused
 * for each of them, and the refusal only helps if it names what does apply — or says plainly that
 * nothing does.
 */
const INSTEAD_OF_RESTORATION: Record<
  Exclude<UserAccessStatus, 'CANCELLED'>,
  (name: string) => string
> = {
  PENDING: (name) =>
    `${name}'s invitation is already pending, so there is nothing to restore. Renew their activation link if they need a new one.`,
  ACTIVE: (name) =>
    `${name} has already activated their access. There is no invitation to restore.`,
  DEACTIVATED: (name) => `${name}'s access was deactivated. Reactivate it instead.`,
}

/**
 * What each refusal means to the administrator who triggered it, in the second person and naming the
 * user. A code absent from here falls back to the API's own message, so a refusal introduced later is
 * still reported rather than swallowed — and a network failure already carries a message that says
 * to try again.
 */
function describeRestorationRefusal(error: ApiError, name: string) {
  if (error.code === 'E_USER_NOT_CANCELLED') {
    const accessStatus = (error.meta as { accessStatus?: string } | undefined)?.accessStatus
    const instead = INSTEAD_OF_RESTORATION[accessStatus as keyof typeof INSTEAD_OF_RESTORATION]

    return instead ? instead(name) : error.message
  }

  const refusals: Record<string, string> = {
    E_USER_NOT_FOUND: `${name} no longer exists. Refresh to see the current users.`,
    E_AUTHORIZATION_FAILURE: 'You are not allowed to restore an invitation.',
  }

  return refusals[error.code] ?? error.message
}

/**
 * The invitation restoration, from confirmation to the link it hands out, mounted by the record
 * footer and by the row menu alike so it reads the same wherever it was started from — and mounted
 * only while open, like `RenewActivationLinkDialog`, so an idle row carries no mutation observer.
 *
 * Not a `UserAccessAction`, although a restoration changes an access status: `UserAccessDialog`
 * ends in a toast, and this one ends in a secret shown once. It needs what the renewal already does
 * — no dismissal once submitted, a result the query cache does not keep, and the link handed to the
 * page (`usePresentActivationLink`) before this dialog closes. That hand-off is not a precaution here:
 * the restored user leaves the cancelled view as soon as the collection refreshes, so the record or
 * row this dialog lives in disappears under the outcome every time.
 *
 * A refusal keeps the confirmation open — `event.preventDefault()` on the confirm action is what
 * stops the primitive from closing on click — so the administrator reads the reason and can retry in
 * place. When the refusal is that the user stopped being cancelled or no longer exists, the refreshed
 * collection drops them from the cancelled view and an open record closes, taking this dialog with
 * it; the toast outlives both, as `UserAccessDialog` documents.
 *
 * The optional comment copies `UserAccessDialog`'s field — the same label, description, and
 * 1,000-character limit — because it follows the cancellation comment's rules: the two comments on
 * either side of a cancelled invitation are read side by side in the access history. A refusal keeps
 * what was typed; dismissing discards it by construction, the dialog unmounting with its state.
 */
export function RestoreInvitationDialog({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const { restoreInvitation } = useUserMutations()
  const presentActivationLink = usePresentActivationLink()
  const commentId = useId()
  const [comment, setComment] = useState('')
  const name = formatFullName(user)
  const isPending = restoreInvitation.isPending

  const submit = async () => {
    try {
      // Trimming is the API's job; the field sends what was typed, or `null` for nothing at all.
      const result = await restoreInvitation.mutateAsync({
        params: { id: user.id },
        body: { comment: comment || null },
      })

      presentActivationLink({
        user: result.data.user,
        activationLink: result.data.activationLink,
        origin: 'restoration',
      })
      onClose()
    } catch (cause) {
      const error = parseApiError(cause)

      toast.error(`Unable to restore ${name}'s invitation`, {
        // A validation failure's top-level message is only "Validation failure"; the field-level
        // detail is what tells the administrator what to fix.
        description: error.details?.[0]?.message ?? describeRestorationRefusal(error, name),
      })
    }
  }

  return (
    // Once submitted, nothing dismisses it until the server answers: the answer may carry the only
    // working link the invited person will get.
    <AlertDialog onOpenChange={(open) => !open && !isPending && onClose()} open={true}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore invitation?</AlertDialogTitle>
          <AlertDialogDescription>
            {name}'s invitation will be pending again. A new activation link, valid for 7 days, will
            be shown once for you to pass on. Any link they were given before stays unusable.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={commentId}>{LIFECYCLE_COMMENT_LABEL}</FieldLabel>
            {/* Frozen while in flight: the request already carries the text, so an edit made now
                would be silently dropped on success. */}
            <Textarea
              disabled={isPending}
              id={commentId}
              maxLength={1000}
              onChange={(event) => setComment(event.target.value)}
              value={comment}
            />
            <FieldDescription>{LIFECYCLE_COMMENT_DESCRIPTION}</FieldDescription>
          </Field>
        </FieldGroup>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            {isPending ? 'Restoring…' : 'Restore invitation'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
