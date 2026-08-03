import { ArchiveIcon, WarehouseIcon } from 'lucide-react'
import type { WarehouseStatus } from '@/features/warehouses/types'
import { classnames } from '@/libraries/shadcn/helpers'

export function WarehouseMarkerSymbol({
  compact = false,
  status,
}: {
  compact?: boolean
  status: WarehouseStatus
}) {
  const archived = status === 'ARCHIVED'

  return (
    <span
      aria-hidden="true"
      className={classnames(
        'relative grid place-items-center rounded-full border-2 transition-colors duration-200 motion-reduce:transition-none',
        compact ? 'size-6 shadow-sm' : 'size-7',
        archived
          ? 'border-muted-foreground border-dashed bg-background/95 text-muted-foreground'
          : 'border-background bg-primary text-primary-foreground',
      )}
      data-warehouse-status={status}
    >
      <WarehouseIcon className={compact ? 'size-3' : 'size-3.5'} />
      {archived && (
        <span
          className={classnames(
            'absolute -right-1 -bottom-1 grid place-items-center rounded-full border border-background bg-muted text-muted-foreground',
            compact ? 'size-3' : 'size-3.5',
          )}
        >
          <ArchiveIcon className={compact ? 'size-1.5' : 'size-2'} />
        </span>
      )}
    </span>
  )
}
