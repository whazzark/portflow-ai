import {
  LIFECYCLE_ACTION_LABELS,
  type LifecycleAction,
} from '@/components/lifecycle/lifecycle-copy'
import {
  type ResourceLifecycleConfig,
  ResourceLifecycleDialog,
} from '@/components/lifecycle/resource-lifecycle-actions'
import type { LifecycleBlock } from '@/components/lifecycle/resource-lifecycle-summary'
import { useTruckMutations } from '@/features/trucks/mutations/use-truck-mutations'
import type { TruckDto } from '@/features/trucks/types'

export const TRUCK_SINGULAR = 'truck'

/**
 * The V2 confirmations name the truck in their title and say what the change means for the fleet
 * in the truck's own terms — discharges, shifts and rotations — rather than the canonical
 * site-reference sentence.
 */
const TRUCK_EFFECTS: Record<LifecycleAction, string> = {
  suspend:
    'The truck is withdrawn from new discharges, shifts and rotations. Discharges it already ' +
    'belongs to continue unchanged. Its registration stays reserved.',
  'return-to-service':
    'It becomes available again for new discharges, shift assignments and rotations. The ' +
    'suspension stays in its history.',
  archive:
    'The truck leaves the fleet for new discharges, shifts and rotations. Past discharges keep it ' +
    'and its registration stays reserved. You can reactivate it later.',
  reactivate:
    'It becomes available again for new discharges, shifts and rotations, with its transport ' +
    'company.',
}

const TRUCK_COMMENT_PLACEHOLDERS: Record<LifecycleAction, string> = {
  suspend: 'Why is this truck suspended? (breakdown, maintenance…)',
  'return-to-service': 'What was done? (optional)',
  archive: 'Why is this truck archived?',
  reactivate: 'Why is this truck reactivated?',
}

function truckDialogTitle(action: LifecycleAction, registration: string) {
  return action === 'return-to-service'
    ? `Return ${registration} to service?`
    : `${LIFECYCLE_ACTION_LABELS[action]} ${registration}?`
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
    describeTitle: (action) => truckDialogTitle(action, truck.registration),
    describeEffect: (action) => TRUCK_EFFECTS[action],
    commentPlaceholder: (action) => TRUCK_COMMENT_PLACEHOLDERS[action],
    // A suspension is easy to mistake for a withdrawal from the work already under way.
    describeSuccessDetail: (action) =>
      action === 'suspend' ? 'It stays in its current discharges.' : undefined,
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
