import { useId, useState } from 'react'
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { useTruckMutations } from '@/features/trucks/mutations/use-truck-mutations'
import type { TruckDto } from '@/features/trucks/types'
import { parseApiError } from '@/libraries/tuyau/api-error'

export type TruckLifecycleAction = 'archive' | 'reactivate' | 'suspend' | 'return-to-service'

export const TRUCK_LIFECYCLE_COPY: Record<
  TruckLifecycleAction,
  {
    label: string
    title: string
    description: string
    success: string
    /**
     * How the action reads inside a failure sentence. Kept separate from `label` because the
     * action's own identifier is not a verb phrase: interpolating it would produce
     * "Unable to return-to-service truck".
     */
    failure: string
  }
> = {
  archive: {
    label: 'Archive',
    title: 'Archive truck?',
    description: 'This truck will remain readable but no longer offered for new operational work.',
    success: 'Truck archived',
    failure: 'archive',
  },
  reactivate: {
    label: 'Reactivate',
    title: 'Reactivate truck?',
    description: 'This truck will become selectable again for new operational work.',
    success: 'Truck reactivated',
    failure: 'reactivate',
  },
  suspend: {
    label: 'Suspend',
    title: 'Suspend truck?',
    description:
      'This truck will be temporarily out of service. It stops being offered for new work, ' +
      'while the discharges, shifts, and rotations it is already part of are left untouched.',
    success: 'Truck suspended',
    failure: 'suspend',
  },
  'return-to-service': {
    label: 'Return to service',
    title: 'Return truck to service?',
    description:
      'This truck will become available again and offered for new discharges, shifts, and ' +
      'rotations, through the assignments it kept while it was out of service.',
    success: 'Truck returned to service',
    failure: 'return to service',
  },
}

// A suspended truck leaves that state only by returning to service: archiving or reactivating it
// requires it to be available first.
export function truckLifecycleActions(status: TruckDto['status']): TruckLifecycleAction[] {
  if (status === 'SUSPENDED') {
    return ['return-to-service']
  }

  return status === 'ARCHIVED' ? ['reactivate'] : ['suspend', 'archive']
}

type TruckLifecycleDialogProps = {
  action: TruckLifecycleAction | null
  onClose: () => void
  truck: TruckDto
}

/**
 * The confirmation half of a lifecycle change, shared by the detail-pane buttons and the
 * per-row actions menu so both offer the same copy, comment, and refusal handling.
 */
export function TruckLifecycleDialog({ action, onClose, truck }: TruckLifecycleDialogProps) {
  const mutations = useTruckMutations()
  const commentId = useId()
  const [comment, setComment] = useState('')

  const close = () => {
    setComment('')
    onClose()
  }

  const submit = async (lifecycleAction: TruckLifecycleAction) => {
    const body = { comment: comment || null }

    try {
      if (lifecycleAction === 'reactivate') {
        await mutations.reactivate.mutateAsync({ params: { id: truck.id }, body })
      } else if (lifecycleAction === 'suspend') {
        await mutations.suspend.mutateAsync({ params: { id: truck.id }, body })
      } else if (lifecycleAction === 'return-to-service') {
        await mutations.returnToService.mutateAsync({ params: { id: truck.id }, body })
      } else {
        await mutations.archive.mutateAsync({ params: { id: truck.id }, body })
      }

      close()
      toast.success(TRUCK_LIFECYCLE_COPY[lifecycleAction].success)
    } catch (error) {
      // A refusal (already suspended/archived/available, in-use, archived transport company) may
      // mean the truck's authoritative state has moved on since this view loaded; refresh so the
      // consultation workspace shows it, not just the success path.
      void mutations.refreshTrucks()
      toast.error(
        `Unable to ${TRUCK_LIFECYCLE_COPY[lifecycleAction].failure} truck “${truck.registration}”`,
        {
          description: parseApiError(error).message,
        },
      )
    }
  }

  const isPending =
    mutations.archive.isPending ||
    mutations.reactivate.isPending ||
    mutations.suspend.isPending ||
    mutations.returnToService.isPending

  return (
    <AlertDialog open={action !== null} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{action ? TRUCK_LIFECYCLE_COPY[action].title : ''}</AlertDialogTitle>
          <AlertDialogDescription>
            {action ? TRUCK_LIFECYCLE_COPY[action].description : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={commentId}>Comment (optional)</FieldLabel>
            <Textarea
              id={commentId}
              maxLength={1000}
              onChange={(event) => setComment(event.target.value)}
              value={comment}
            />
            <FieldDescription>
              Keep a short explanation for the lifecycle change (maximum 1,000 characters).
            </FieldDescription>
          </Field>
        </FieldGroup>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() => {
              if (action) {
                void submit(action)
              }
            }}
          >
            {action ? TRUCK_LIFECYCLE_COPY[action].label : ''}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

type TruckLifecycleActionsProps = {
  className?: string
  truck: TruckDto
}

export function TruckLifecycleActions({ className, truck }: TruckLifecycleActionsProps) {
  const [openAction, setOpenAction] = useState<TruckLifecycleAction | null>(null)

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {truckLifecycleActions(truck.status).map((action) => (
          <Button
            key={action}
            onClick={() => setOpenAction(action)}
            type="button"
            variant={
              action === 'archive' ? 'destructive' : action === 'suspend' ? 'outline' : 'default'
            }
          >
            {TRUCK_LIFECYCLE_COPY[action].label}
          </Button>
        ))}
      </div>
      <TruckLifecycleDialog action={openAction} onClose={() => setOpenAction(null)} truck={truck} />
    </div>
  )
}
