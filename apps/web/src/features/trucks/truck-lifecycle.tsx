import type {
  BulkLifecycleBlocker,
  BulkLifecycleOutcome,
} from '@/components/lifecycle/bulk-resource-lifecycle-actions'
import type { LifecycleAction } from '@/components/lifecycle/lifecycle-copy'
import {
  ResourceLifecycleActions,
  type ResourceLifecycleConfig,
  ResourceLifecycleDialog,
} from '@/components/lifecycle/resource-lifecycle-actions'
import type { LifecycleBlock } from '@/components/lifecycle/resource-lifecycle-summary'
import { useTruckMutations } from '@/features/trucks/mutations/use-truck-mutations'
import type { BulkTruckLifecycleResult, TruckDto } from '@/features/trucks/types'

export const TRUCK_SINGULAR = 'truck'
export const TRUCK_PLURAL = 'trucks'

/** Reasons a truck refuses a bulk transition that the shared four do not cover. */
export const TRUCK_BLOCKER_REASON_LABELS = {
  SUSPENDED: 'out of service',
  TRANSPORT_COMPANY_ARCHIVED: 'archived transport company',
}

// A suspended truck leaves that state only by returning to service: archiving or reactivating it
// requires it to be available first.
export function truckLifecycleActions(status: TruckDto['status']): LifecycleAction[] {
  if (status === 'SUSPENDED') {
    return ['return-to-service']
  }

  return status === 'ARCHIVED' ? ['reactivate'] : ['suspend', 'archive']
}

/** Every lifecycle transition a truck carries, for its detail pane. The summary orders them and
 * drops the ones that never happened. */
export function truckLifecycleBlocks(truck: TruckDto, withActor: boolean): LifecycleBlock[] {
  // Non-administrators read the suspended collection, which withholds the actors; the rows are
  // then left out rather than shown empty.
  const actor = <T,>(value: T) => (withActor ? value : undefined)

  return [
    {
      action: 'archive',
      at: truck.archivedAt,
      actor: actor(truck.archivedBy),
      comment: truck.archiveComment,
    },
    {
      action: 'reactivate',
      at: truck.reactivatedAt,
      actor: actor(truck.reactivatedBy),
      comment: truck.reactivationComment,
    },
    {
      action: 'suspend',
      at: truck.suspendedAt,
      actor: actor(truck.suspendedBy),
      comment: truck.suspensionComment,
    },
    {
      action: 'return-to-service',
      at: truck.returnedToServiceAt,
      actor: actor(truck.returnedToServiceBy),
      comment: truck.returnToServiceComment,
    },
  ]
}

export function useTruckLifecycleConfig(truck: TruckDto): ResourceLifecycleConfig {
  const mutations = useTruckMutations()

  return {
    singular: TRUCK_SINGULAR,
    name: truck.registration,
    isPending:
      mutations.archive.isPending ||
      mutations.reactivate.isPending ||
      mutations.suspend.isPending ||
      mutations.returnToService.isPending,
    refresh: mutations.refreshTrucks,
    submit: (action, body) => {
      const params = { id: truck.id }

      if (action === 'reactivate') {
        return mutations.reactivate.mutateAsync({ params, body })
      }

      if (action === 'suspend') {
        return mutations.suspend.mutateAsync({ params, body })
      }

      if (action === 'return-to-service') {
        return mutations.returnToService.mutateAsync({ params, body })
      }

      return mutations.archive.mutateAsync({ params, body })
    },
  }
}

/** The confirmation on its own, for the row menus: it owns the mutation hooks so a directory row
 * runs none of them until an administrator actually opens a confirmation. */
export function TruckLifecycleDialog({
  action,
  onClose,
  truck,
}: {
  action: LifecycleAction
  onClose: () => void
  truck: TruckDto
}) {
  const config = useTruckLifecycleConfig(truck)

  return <ResourceLifecycleDialog action={action} config={config} onClose={onClose} />
}

export function TruckLifecycleActions({
  className,
  truck,
}: {
  className?: string
  truck: TruckDto
}) {
  const config = useTruckLifecycleConfig(truck)

  return (
    <ResourceLifecycleActions
      actions={truckLifecycleActions(truck.status)}
      className={className}
      config={config}
    />
  )
}

export function toBulkTruckLifecycleOutcome(
  result: BulkTruckLifecycleResult,
): BulkLifecycleOutcome {
  return {
    updatedCount: result.updatedTrucks.length,
    blocked: result.blockedTrucks.map(
      (blocked): BulkLifecycleBlocker => ({
        id: blocked.id,
        name: blocked.registration ?? undefined,
        reason: blocked.reason,
      }),
    ),
  }
}
