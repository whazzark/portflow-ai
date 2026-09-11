import { CopyIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { formatFullName } from '@/features/users/helpers/name'
import type { ActivationLinkDto, UserDto } from '@/features/users/types'
import { formatDateTime } from '@/helpers/dates'

type ActivationLinkDialogProps = {
  open: boolean
  /** Absent once the outcome has been left, or after a reload: the secret has no second read. */
  activationLink?: ActivationLinkDto
  invitedUser?: UserDto
  onAcknowledge: () => void
}

/**
 * A modal dialog rather than the sheet the form lives in, and deliberately so: the invitation
 * outcome is terminal, not a step. A sheet is the surface this application consults and leaves,
 * which is the one thing this link cannot survive — so the surface changes when the moment does.
 *
 * Nothing dismisses it but the acknowledgement: an Escape or a click outside would discard a secret
 * that will never be shown again.
 */
export function ActivationLinkDialog({
  open,
  activationLink,
  invitedUser,
  onAcknowledge,
}: ActivationLinkDialogProps) {
  const invitedName = invitedUser ? formatFullName(invitedUser) : 'The invited user'

  const copyLink = async () => {
    if (!activationLink) {
      return
    }

    try {
      await navigator.clipboard.writeText(activationLink.url)
      toast.success('Activation link copied')
    } catch {
      // The link stays on screen and selectable: a clipboard the browser refuses is not a reason to
      // lose a secret that will never be shown again.
      toast.error('Unable to copy the activation link', {
        description: 'Select the link and copy it manually before closing this dialog.',
      })
    }
  }

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Activation link</AlertDialogTitle>
          <AlertDialogDescription>
            {`${invitedName} is now pending activation. Hand them this link so they can choose their password.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {activationLink ? (
          <div className="flex flex-col gap-4">
            <Alert>
              <AlertTitle>This link is shown once</AlertTitle>
              <AlertDescription>
                {`Copy it now: it cannot be displayed again. It stops working on ${formatDateTime(activationLink.expiresAt)}.`}
              </AlertDescription>
            </Alert>
            <div className="flex items-center gap-2 rounded-md border bg-muted py-2 pr-2 pl-3">
              <code
                className="min-w-0 flex-1 select-all break-all font-mono text-xs"
                data-testid="activation-link"
              >
                {activationLink.url}
              </code>
              <Button
                aria-label="Copy activation link"
                className="shrink-0"
                onClick={() => void copyLink()}
                size="icon-sm"
                variant="ghost"
              >
                <CopyIcon aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : (
          <Alert variant="destructive">
            <AlertTitle>Activation link no longer available</AlertTitle>
            <AlertDescription>
              {`It was shown once and cannot be displayed again. Renew the activation link to issue a new one for ${invitedName}.`}
            </AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogAction onClick={onAcknowledge}>Done</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
