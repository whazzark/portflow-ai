import { CopyIcon } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { ResourceLifecycleSummary } from '@/components/lifecycle/resource-lifecycle-summary'
import type { ResourceMapAnchor } from '@/components/resource-map/resource-map-anchor'
import { ResourceMapCard } from '@/components/resource-map/resource-map-card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { footprintCentre, formatCoordinates } from '@/features/warehouses/geometry/footprint-centre'
import type { WarehouseWithDoorsDto } from '@/features/warehouses/types'
import { warehouseLifecycleBlocks } from '@/features/warehouses/warehouse-lifecycle'
import { copyText } from '@/helpers/copy-text'
import { formatDateTime } from '@/helpers/dates'

const STATUS_LABELS = { AVAILABLE: 'Available', ARCHIVED: 'Archived' } as const

/**
 * The selected warehouse, beside its outline: footprint, doors, history, and — in `footer` — what
 * the viewer may do with it. Read-only itself; every action arrives from the page.
 */
export function WarehouseCard({
  warehouse,
  anchor,
  onClose,
  doors,
  footer,
  cardRef,
}: {
  cardRef?: RefObject<HTMLElement | null>
  warehouse: WarehouseWithDoorsDto
  anchor: ResourceMapAnchor | null
  onClose: () => void
  doors?: ReactNode
  footer?: ReactNode
}) {
  const points = warehouse.footprint.points
  const centre = formatCoordinates(footprintCentre(points))
  const lifecycleBlocks = warehouseLifecycleBlocks(warehouse)

  return (
    <ResourceMapCard
      anchor={anchor}
      footer={footer}
      onClose={onClose}
      ref={cardRef}
      subtitle={`Warehouse · ${STATUS_LABELS[warehouse.status]}`}
      title={warehouse.name}
    >
      <section aria-label="Footprint" className="px-4 py-3">
        <h3 className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
          Footprint
        </h3>
        <div className="mt-1 flex items-center gap-1 text-sm">
          <span className="min-w-0 flex-1">
            {points.length} boundary points · centre{' '}
            <span className="font-mono tabular-nums">{centre}</span>
          </span>
          <Button
            aria-label="Copy centre coordinates"
            onClick={() => void copyText(centre, 'Coordinates')}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <CopyIcon aria-hidden="true" />
          </Button>
        </div>
      </section>
      {warehouse.status === 'ARCHIVED' && warehouse.archivedAt && (
        <p className="mx-4 rounded-md bg-muted px-3 py-2 text-muted-foreground text-xs">
          Archived on {formatDateTime(warehouse.archivedAt)}. It and its doors can’t be selected for
          new discharges; past discharges keep them.
        </p>
      )}
      {doors}
      {lifecycleBlocks.some((block) => block.at) && (
        <div className="px-4 pb-3">
          <Separator className="mb-3" />
          <ResourceLifecycleSummary blocks={lifecycleBlocks} />
        </div>
      )}
      <p className="px-4 pb-3 text-muted-foreground text-xs">
        Updated {formatDateTime(warehouse.updatedAt)} · created{' '}
        {formatDateTime(warehouse.createdAt)}
      </p>
    </ResourceMapCard>
  )
}
