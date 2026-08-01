import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { WeighingAreaDto } from '@/features/weighing-areas/types'
import { formatDateTime } from '@/helpers/dates'

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export function WeighingAreaDetails({ area }: { area: WeighingAreaDto }) {
  const hasLifecycle = Boolean(area.archivedAt || area.reactivatedAt)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="shrink-0 border-b">
        <SheetTitle>{area.name}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-2">
          <Badge variant={area.status === 'ARCHIVED' ? 'outline' : 'secondary'}>
            {area.status === 'ARCHIVED' ? 'Archived' : 'Available'}
          </Badge>
          {area.status === 'ARCHIVED' && (
            <span>Archived weighing areas cannot receive new operations.</span>
          )}
        </SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
          <Detail label="Latitude" value={String(area.latitude)} />
          <Detail label="Longitude" value={String(area.longitude)} />
          <Detail label="Created" value={formatDateTime(area.createdAt)} />
          <Detail label="Last updated" value={formatDateTime(area.updatedAt)} />
        </dl>
        {hasLifecycle && (
          <>
            <Separator className="my-6" />
            <section
              aria-labelledby="weighing-area-lifecycle-heading"
              className="flex flex-col gap-3"
            >
              <h3 className="font-medium" id="weighing-area-lifecycle-heading">
                Lifecycle
              </h3>
              <dl className="grid gap-4 text-sm">
                {area.archivedAt && (
                  <Detail label="Archived" value={formatDateTime(area.archivedAt)} />
                )}
                {area.archiveComment && (
                  <Detail label="Archive comment" value={area.archiveComment} />
                )}
                {area.reactivatedAt && (
                  <Detail label="Reactivated" value={formatDateTime(area.reactivatedAt)} />
                )}
                {area.reactivationComment && (
                  <Detail label="Reactivation comment" value={area.reactivationComment} />
                )}
              </dl>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
