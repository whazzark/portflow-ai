import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

/**
 * Every lifecycle state a site reference can be presented in. Most resources only ever reach
 * `AVAILABLE` and `ARCHIVED`; the truck adds `SUSPENDED`, which `CONTEXT.md` keeps deliberately
 * apart from archival — a temporary immobilisation, not a retirement.
 */
export type ResourceStatus = 'AVAILABLE' | 'ARCHIVED' | 'SUSPENDED'

/** How a status reads wherever it is spelled out — the badge, and any field repeating it. */
export const RESOURCE_STATUS_LABELS: Record<ResourceStatus, string> = {
  AVAILABLE: 'Available',
  ARCHIVED: 'Archived',
  SUSPENDED: 'Suspended',
}

// Suspension reads as `destructive` rather than `outline`: an archived record is a settled,
// quiet state, whereas a suspended one is an anomaly someone is expected to resolve.
const STATUS_VARIANTS: Record<ResourceStatus, 'secondary' | 'outline' | 'destructive'> = {
  AVAILABLE: 'secondary',
  ARCHIVED: 'outline',
  SUSPENDED: 'destructive',
}

export function ResourceStatusBadge({ status }: { status: ResourceStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{RESOURCE_STATUS_LABELS[status]}</Badge>
}

export function ResourceDetailHeader({
  name,
  status,
  archivedMessage,
  children,
}: {
  name: string
  status: ResourceStatus
  archivedMessage?: string
  /**
   * Badges qualifying the record beyond its own lifecycle state — a truck whose transport company
   * has since been archived says so here. They sit after the status badge because they describe
   * the record's context, not the record; a resource with nothing to add passes none.
   */
  children?: ReactNode
}) {
  return (
    <SheetHeader className="shrink-0 border-b">
      <SheetTitle>{name}</SheetTitle>
      <SheetDescription className="flex flex-wrap items-center gap-2">
        <ResourceStatusBadge status={status} />
        {children}
        {status === 'ARCHIVED' && archivedMessage && <span>{archivedMessage}</span>}
      </SheetDescription>
    </SheetHeader>
  )
}

export function ResourceDetailField({ label, value }: { label: string; value?: string | null }) {
  const isSpecified = value !== undefined && value !== null && value !== ''

  return (
    <div className="grid gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        {isSpecified ? value : <span className="text-muted-foreground italic">Not specified</span>}
      </dd>
    </div>
  )
}

export function ResourceDetailBody({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">{children}</div>
}
