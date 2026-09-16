import type { ReactNode } from 'react'

import { type ResourceStatus, ResourceStatusBadge } from '@/components/resource/resource-details'

type ReferenceLabelProps = {
  name: string
  /** Null where the reference is gone altogether, as a cleared transport company link is. */
  status: ResourceStatus | null
  /**
   * Hints about the reference itself, such as the other discharges holding a truck. They sit
   * against its name, before the state badge, so they never read as qualifying the badge.
   */
  children?: ReactNode
}

/**
 * A site reference as a discharge shows it: its name, and a badge only when it is no longer
 * available. An available reference is the normal case and needs no badge; an archived or
 * suspended one stays readable as history and says what it has become.
 */
export function ReferenceLabel({ children, name, status }: ReferenceLabelProps) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5">
        <span>{name}</span>
        {children}
      </span>
      {status && status !== 'AVAILABLE' && <ResourceStatusBadge status={status} />}
    </span>
  )
}
