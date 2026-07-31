import { ArchiveIcon, Building2Icon, CircleCheckIcon } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type TransportCompanyOverviewProps = {
  availableCount: number
  archivedCount: number
}

export function TransportCompanyOverview({
  availableCount,
  archivedCount,
}: TransportCompanyOverviewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5 md:p-6">
      <header className="max-w-2xl">
        <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-muted">
          <Building2Icon aria-hidden className="size-5" />
        </div>
        <h2 className="font-heading font-semibold text-xl">All transport companies</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Browse the company directory or select one company to inspect its lifecycle details.
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
        <Card size="sm">
          <CardHeader>
            <ArchiveIcon aria-hidden className="size-4 text-muted-foreground" />
            <CardDescription>Archived</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{archivedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <Building2Icon aria-hidden className="size-4 text-muted-foreground" />
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {availableCount + archivedCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="mt-4 max-w-3xl" size="sm">
        <CardContent className="text-muted-foreground text-sm">
          Available companies can provide trucks for current operations. Archived companies remain
          visible for historical consultation.
        </CardContent>
      </Card>
    </div>
  )
}
