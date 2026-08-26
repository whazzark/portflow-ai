import type { LifecycleAction } from '@/components/lifecycle/lifecycle-copy'
import {
  ResourceLifecycleActions,
  type ResourceLifecycleConfig,
} from '@/components/lifecycle/resource-lifecycle-actions'
import type { LifecycleBlock } from '@/components/lifecycle/resource-lifecycle-summary'
import { useDockMutations } from '@/features/docks/mutations/use-dock-mutations'
import type { DockDto } from '@/features/docks/types'

export const DOCK_SINGULAR = 'dock'
export const DOCK_PLURAL = 'docks'

export function dockLifecycleActions(status: DockDto['status']): LifecycleAction[] {
  return status === 'ARCHIVED' ? ['reactivate'] : ['archive']
}

/** Every lifecycle transition this record carries, for its detail pane. The summary
 * orders them and drops the ones that never happened. The read contract
 * exposes only the actor id, so no actor is reported yet. */
export function dockLifecycleBlocks(dock: DockDto): LifecycleBlock[] {
  return [
    {
      action: 'archive',
      at: dock.archivedAt,
      comment: dock.archiveComment,
    },
    {
      action: 'reactivate',
      at: dock.reactivatedAt,
      comment: dock.reactivationComment,
    },
  ]
}

function useDockLifecycleConfig(dock: DockDto): ResourceLifecycleConfig {
  const mutations = useDockMutations()

  return {
    singular: DOCK_SINGULAR,
    name: dock.name,
    isPending: mutations.archive.isPending || mutations.reactivate.isPending,
    refresh: mutations.refreshDocks,
    submit: (action, body) =>
      action === 'reactivate'
        ? mutations.reactivate.mutateAsync({ params: { id: dock.id }, body })
        : mutations.archive.mutateAsync({ params: { id: dock.id }, body }),
  }
}

export function DockLifecycleActions({ className, dock }: { className?: string; dock: DockDto }) {
  const config = useDockLifecycleConfig(dock)

  return (
    <ResourceLifecycleActions
      actions={dockLifecycleActions(dock.status)}
      className={className}
      config={config}
    />
  )
}
