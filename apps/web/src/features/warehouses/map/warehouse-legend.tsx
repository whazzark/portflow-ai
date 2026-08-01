import { ArchiveIcon } from 'lucide-react'
import { classnames } from '@/libraries/shadcn/helpers'

function WarehouseLegendStatusSymbol({ status }: { status: 'AVAILABLE' | 'ARCHIVED' }) {
  const archived = status === 'ARCHIVED'

  return (
    <span
      aria-hidden="true"
      className={classnames(
        'relative grid size-6 shrink-0 place-items-center rounded-full border-2 shadow-sm',
        archived
          ? 'border-muted-foreground border-dashed bg-background/95 text-muted-foreground'
          : 'border-background bg-primary',
      )}
      data-testid={`warehouse-legend-status-${status.toLowerCase()}`}
    >
      {archived && (
        <span className="absolute -right-1 -bottom-1 grid size-3.5 place-items-center rounded-full border border-background bg-muted text-muted-foreground">
          <ArchiveIcon aria-hidden="true" className="size-2" />
        </span>
      )}
    </span>
  )
}

export function WarehouseLegend() {
  return (
    <section
      aria-label="Warehouse legend"
      className="pointer-events-none w-fit max-w-full rounded-lg border bg-background/95 px-3 py-2.5 text-foreground shadow-md backdrop-blur"
    >
      <fieldset aria-label="Warehouse statuses" className="grid gap-1.5">
        <legend className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
          Status
        </legend>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-1.5 text-xs">
            <WarehouseLegendStatusSymbol status="AVAILABLE" />
            Available
          </span>
          <span className="flex items-center gap-1.5 text-xs">
            <WarehouseLegendStatusSymbol status="ARCHIVED" />
            Archived
          </span>
        </div>
      </fieldset>
    </section>
  )
}
