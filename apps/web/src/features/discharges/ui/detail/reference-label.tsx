import { type ResourceStatus, ResourceStatusBadge } from '@/components/resource/resource-details'

type ReferenceLabelProps = {
  name: string
  /** Null where the reference is gone altogether, as a cleared transport company link is. */
  status: ResourceStatus | null
}

/**
 * A site reference as a discharge shows it: its name, and a badge only when it is no longer
 * available. An available reference is the normal case and needs no badge; an archived or
 * suspended one stays readable as history and says what it has become.
 */
export function ReferenceLabel({ name, status }: ReferenceLabelProps) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{name}</span>
      {status && status !== 'AVAILABLE' && <ResourceStatusBadge status={status} />}
    </span>
  )
}
