import { ArchiveIcon, CircleCheckIcon, TruckIcon } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type TruckOverviewProps = {
  availableCount: number
  archivedCount?: number
}

export function TruckOverview({ availableCount, archivedCount }: TruckOverviewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5 md:p-6">
      <header className="max-w-2xl">
        <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-muted">
          <TruckIcon aria-hidden className="size-5" />
        </div>
        <h2 className="font-heading font-semibold text-xl">Truck directory</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Browse trucks and their current transport companies, or select one to inspect details.
        </p>
      </header>

      <div className="mt-6 grid max-w-3xl gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CircleCheckIcon aria-hidden className="size-4 text-muted-foreground" />
            <CardDescription>Available</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{availableCount}</CardTitle>
          </CardHeader>
        </Card>
        {archivedCount !== undefined && (
          <>
            <Card size="sm">
              <CardHeader>
                <ArchiveIcon aria-hidden className="size-4 text-muted-foreground" />
                <CardDescription>Archived</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{archivedCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card size="sm">
              <CardHeader>
                <TruckIcon aria-hidden className="size-4 text-muted-foreground" />
                <CardDescription>Total</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {availableCount + archivedCount}
                </CardTitle>
              </CardHeader>
            </Card>
          </>
        )}
      </div>

      <Card className="mt-4 max-w-3xl" size="sm">
        <CardContent className="text-muted-foreground text-sm">
          Available trucks can be considered for current operations. Archived trucks remain
          consultation-only for administrators.
        </CardContent>
      </Card>
    </div>
  )
}
