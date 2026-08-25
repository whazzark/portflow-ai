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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { useTruckMutations } from '@/features/trucks/mutations/use-truck-mutations'
import type { TruckDto } from '@/features/trucks/types'
import { parseApiError } from '@/libraries/tuyau/api-error'

type TruckLifecycleActionsProps = {
  className?: string
  truck: TruckDto
}

type LifecycleAction = 'archive' | 'reactivate' | 'suspend'

const COPY: Record<
  LifecycleAction,
  { trigger: string; title: string; description: string; confirm: string; success: string }
> = {
  archive: {
    trigger: 'Archive truck',
    title: 'Archive truck?',
    description: 'This truck will remain readable but no longer offered for new operational work.',
    confirm: 'Archive',
    success: 'Truck archived',
  },
  reactivate: {
    trigger: 'Reactivate truck',
    title: 'Reactivate truck?',
    description: 'This truck will become selectable again for new operational work.',
    confirm: 'Reactivate',
    success: 'Truck reactivated',
  },
  suspend: {
    trigger: 'Suspend truck',
    title: 'Suspend truck?',
    description:
      'This truck will be temporarily out of service. It stops being offered for new work, ' +
      'while the discharges, shifts, and rotations it is already part of are left untouched.',
    confirm: 'Suspend',
    success: 'Truck suspended',
  },
}

export function TruckLifecycleActions({ className, truck }: TruckLifecycleActionsProps) {
  const mutations = useTruckMutations()

  const [openAction, setOpenAction] = useState<LifecycleAction | null>(null)
  const [comment, setComment] = useState('')

  // A suspended truck has no lifecycle action yet: returning it to service is its own delivery
  // slice, and archiving it requires it to be available first.
  if (truck.status === 'SUSPENDED') {
    return (
      <p className={className} data-testid="truck-suspended-notice">
        This truck is out of service. It must be returned to service before it can be archived, and
        returning a truck to service is not available yet.
      </p>
    )
  }

  const archived = truck.status === 'ARCHIVED'
  const actions: LifecycleAction[] = archived ? ['reactivate'] : ['suspend', 'archive']

  const close = () => {
    setOpenAction(null)
    setComment('')
  }

  const submit = async (action: LifecycleAction) => {
    const body = { comment: comment || null }

    try {
      if (action === 'reactivate') {
        await mutations.reactivate.mutateAsync({ params: { id: truck.id }, body })
      } else if (action === 'suspend') {
        await mutations.suspend.mutateAsync({ params: { id: truck.id }, body })
      } else {
        await mutations.archive.mutateAsync({ params: { id: truck.id }, body })
      }

      close()
      toast.success(COPY[action].success)
    } catch (error) {
      // A refusal (already suspended/archived/available, in-use, archived transport company) may
      // mean the truck's authoritative state has moved on since this view loaded; refresh so the
      // consultation workspace shows it, not just the success path.
      void mutations.refreshTrucks()
      toast.error(`Unable to ${action} truck “${truck.registration}”`, {
        description: parseApiError(error).message,
      })
    }
  }

  const isPending =
    mutations.archive.isPending || mutations.reactivate.isPending || mutations.suspend.isPending

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action}
            onClick={() => setOpenAction(action)}
            type="button"
            variant={
              action === 'archive' ? 'destructive' : action === 'suspend' ? 'outline' : 'default'
            }
          >
            {COPY[action].trigger}
          </Button>
        ))}
      </div>
      <AlertDialog open={openAction !== null} onOpenChange={(open) => !open && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{openAction ? COPY[openAction].title : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              {openAction ? COPY[openAction].description : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="truck-lifecycle-comment">Comment (optional)</FieldLabel>
              <Textarea
                id="truck-lifecycle-comment"
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
                if (openAction) {
                  void submit(openAction)
                }
              }}
            >
              {openAction ? COPY[openAction].confirm : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
