import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { DockDto } from '@/features/docks/types'
import { formatDateTime } from '@/helpers/dates'

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export function DockDetails({ dock }: { dock: DockDto }) {
  const hasLifecycle = Boolean(dock.archivedAt || dock.reactivatedAt)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="shrink-0 border-b">
        <SheetTitle>{dock.name}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-2">
          <Badge variant={dock.status === 'ARCHIVED' ? 'outline' : 'secondary'}>
            {dock.status === 'ARCHIVED' ? 'Archived' : 'Available'}
          </Badge>
          {dock.status === 'ARCHIVED' && <span>Archived docks cannot receive new operations.</span>}
        </SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
          <Detail label="Latitude" value={String(dock.latitude)} />
          <Detail label="Longitude" value={String(dock.longitude)} />
          <Detail label="Created" value={formatDateTime(dock.createdAt)} />
          <Detail label="Last updated" value={formatDateTime(dock.updatedAt)} />
        </dl>
        {hasLifecycle && (
          <>
            <Separator className="my-6" />
            <section aria-labelledby="dock-lifecycle-heading" className="flex flex-col gap-3">
              <h3 className="font-medium" id="dock-lifecycle-heading">
                Lifecycle
              </h3>
              <dl className="grid gap-4 text-sm">
                {dock.archivedAt && (
                  <Detail label="Archived" value={formatDateTime(dock.archivedAt)} />
                )}
                {dock.archiveComment && (
                  <Detail label="Archive comment" value={dock.archiveComment} />
                )}
                {dock.reactivatedAt && (
                  <Detail label="Reactivated" value={formatDateTime(dock.reactivatedAt)} />
                )}
                {dock.reactivationComment && (
                  <Detail label="Reactivation comment" value={dock.reactivationComment} />
                )}
              </dl>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
