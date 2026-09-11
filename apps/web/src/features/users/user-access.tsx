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
import type { SessionUser } from '@/features/auth/context/session-context'
import { formatFullName } from '@/features/users/helpers/name'
import {
  describeUserAccessEffect,
  describeUserAccessRefusal,
  USER_ACCESS_ACTION_LABELS,
  USER_ACCESS_DISMISS_LABELS,
  USER_ACCESS_PENDING_LABELS,
  USER_ACCESS_TAKES_COMMENT,
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
  'cancel-invitation': 'destructive',
}

/**
 * Which access actions this user's record offers this viewer — asked by the record footer and by
 * the directory row menu alike, so the two can never disagree about what is available.
 *
 * The API enforces every condition regardless. Managing access is the organization admin's
 * responsibility; deactivation is the transition out of active access, and retiring your own access
 * is something another administrator does for you; invitation cancellation is the transition out of
 * pending access, which the viewer — active by definition — can never hold themselves. An action
 * that does not apply is absent rather than disabled — a dead control with no explanation reads as
 * a bug.
 */
export function userAccessActions(viewer: SessionUser, user: UserDto): UserAccessAction[] {
  if (viewer.role !== 'ORGANIZATION_ADMIN') {
    return []
  }

  if (user.accessStatus === 'PENDING') {
    return ['cancel-invitation']
  }

  return user.accessStatus === 'ACTIVE' && user.id !== viewer.id ? ['deactivate'] : []
}

/**
 * The confirmation on its own, mounted by the record footer and by the row menu, so an access
 * change reads the same wherever it was started from. It owns the mutation hook and is mounted only
 * while a confirmation is open: the directory lists every user of a view, and an idle row must not
 * carry a mutation observer per action it could offer.
 *
 * A refusal keeps the dialog open so the administrator reads the reason in place, with any typed
 * comment intact; `event.preventDefault()` on the confirm action is what stops the dialog primitive
 * from closing. Dismissing discards the comment by construction: the dialog unmounts with its state.
 *
 * The comment field copies the shape of `ResourceLifecycleDialog`'s — the same label, description,
 * and 1,000-character limit — rather than the component, whose copy is keyed to the site reference
 * lifecycle and whose dismiss button is a fixed `Cancel`.
 *
 * With one exception, and it is the commonest refusal: when the reason is that this record moved on
 * — someone else deactivated this user, or cancelled their invitation, first — the refreshed
 * collection no longer lists them in the view the record was opened from, `UsersPage` closes the record it can no longer find, and the record footer
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
  const { deactivate, cancelInvitation } = useUserMutations()
  const commentId = useId()
  const [comment, setComment] = useState('')
  const name = formatFullName(user)
  const isPending = action === 'deactivate' ? deactivate.isPending : cancelInvitation.isPending

  // Trimming is the API's job; the field sends what was typed, or `null` for nothing at all.
  const request = () =>
    action === 'deactivate'
      ? deactivate.mutateAsync({ params: { id: user.id } })
      : cancelInvitation.mutateAsync({
          params: { id: user.id },
          body: { comment: comment || null },
        })

  const submit = async () => {
    try {
      await request()

      onClose()
      toast.success(userAccessSuccessMessage(action, name))
    } catch (cause) {
      const error = parseApiError(cause)

      toast.error(userAccessFailureTitle(action, name), {
        // A validation failure's top-level message is only "Validation failure"; the field-level
        // detail is what tells the administrator what to fix.
        description:
          error.details?.[0]?.message ??
          describeUserAccessRefusal(action, error.code, error.message),
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
        {USER_ACCESS_TAKES_COMMENT[action] && (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={commentId}>{LIFECYCLE_COMMENT_LABEL}</FieldLabel>
              <Textarea
                id={commentId}
                maxLength={1000}
                onChange={(event) => setComment(event.target.value)}
                value={comment}
              />
              <FieldDescription>{LIFECYCLE_COMMENT_DESCRIPTION}</FieldDescription>
            </Field>
          </FieldGroup>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{USER_ACCESS_DISMISS_LABELS[action]}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            {isPending ? USER_ACCESS_PENDING_LABELS[action] : USER_ACCESS_ACTION_LABELS[action]}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
