import { FilterIcon, InfoIcon, SearchIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function CompanyFilterBanner({
  companyName,
  hiddenCompanyCount,
  onShowAll,
}: {
  companyName: string
  hiddenCompanyCount: number
  onShowAll: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
      <FilterIcon aria-hidden="true" className="size-4 text-indicator" />
      <span>
        Showing <span className="font-semibold">{companyName}</span>
      </span>
      <Button aria-label="Show all companies" onClick={onShowAll} size="icon-sm" variant="ghost">
        <XIcon aria-hidden="true" />
      </Button>
      <span className="text-muted-foreground">
        {hiddenCompanyCount === 1
          ? '1 other company hidden'
          : `${hiddenCompanyCount} other companies hidden`}
      </span>
    </div>
  )
}

export function ArchivedNotice() {
  return (
    <p className="flex items-center gap-2 text-muted-foreground text-sm">
      <InfoIcon aria-hidden="true" className="size-4" />
      Reactivate the company first to reactivate one of its trucks.
    </p>
  )
}

/** The table body when a search leaves nothing to list. */
export function FleetNoMatch({
  search,
  archivedIncluded,
  onClearSearch,
  onIncludeArchived,
}: {
  search: string
  archivedIncluded: boolean
  onClearSearch: () => void
  onIncludeArchived: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 whitespace-normal px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <SearchIcon aria-hidden="true" className="size-5" />
      </span>
      <span className="font-semibold text-[15px]">No truck or company matches “{search}”</span>
      <span className="max-w-[420px] text-muted-foreground text-sm">
        Search looks in registrations, vehicle models and company names, for the statuses selected
        above.{archivedIncluded ? '' : ' Archived trucks are hidden.'}
      </span>
      <div className="mt-1.5 flex gap-2">
        <Button onClick={onClearSearch} variant="outline">
          Clear search
        </Button>
        {!archivedIncluded && (
          <Button onClick={onIncludeArchived} variant="ghost">
            Include archived
          </Button>
        )}
      </div>
    </div>
  )
}
