import type { LifecycleAction } from '@/components/lifecycle/lifecycle-copy'
import {
  ResourceLifecycleActions,
  type ResourceLifecycleConfig,
} from '@/components/lifecycle/resource-lifecycle-actions'
import type { LifecycleBlock } from '@/components/lifecycle/resource-lifecycle-summary'
import { useWeighingAreaMutations } from '@/features/weighing-areas/mutations/use-weighing-area-mutations'
import type { WeighingAreaDto } from '@/features/weighing-areas/types'

export const WEIGHING_AREA_SINGULAR = 'weighing area'
export const WEIGHING_AREA_PLURAL = 'weighing areas'

export function weighingAreaLifecycleActions(status: WeighingAreaDto['status']): LifecycleAction[] {
  return status === 'ARCHIVED' ? ['reactivate'] : ['archive']
}

/** Every lifecycle transition this record carries, for its detail pane. The summary
 * orders them and drops the ones that never happened. The read contract
 * exposes only the actor id, so no actor is reported yet. */
export function weighingAreaLifecycleBlocks(area: WeighingAreaDto): LifecycleBlock[] {
  return [
    {
      action: 'archive',
      at: area.archivedAt,
      comment: area.archiveComment,
    },
    {
      action: 'reactivate',
      at: area.reactivatedAt,
      comment: area.reactivationComment,
    },
  ]
}

function useWeighingAreaLifecycleConfig(area: WeighingAreaDto): ResourceLifecycleConfig {
  const mutations = useWeighingAreaMutations()

  return {
    singular: WEIGHING_AREA_SINGULAR,
    name: area.name,
    isPending: mutations.archive.isPending || mutations.reactivate.isPending,
    refresh: mutations.refreshWeighingAreas,
    submit: (action, body) =>
      action === 'reactivate'
        ? mutations.reactivate.mutateAsync({ params: { id: area.id }, body })
        : mutations.archive.mutateAsync({ params: { id: area.id }, body }),
  }
}

export function WeighingAreaLifecycleActions({
  area,
  className,
}: {
  area: WeighingAreaDto
  className?: string
}) {
  const config = useWeighingAreaLifecycleConfig(area)

  return (
    <ResourceLifecycleActions
      actions={weighingAreaLifecycleActions(area.status)}
      className={className}
      config={config}
    />
  )
}
