import { HighlightedText } from '@/components/highlighted-text'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import type { TruckDto, TruckLifecycle } from '@/features/trucks/types'
import { classnames } from '@/libraries/shadcn/helpers'

type TruckListProps = {
  trucks: TruckDto[]
  lifecycle: TruckLifecycle
  search: string
  selectedId?: string
  emptyTitle: string
  emptyDescription: string
  onSelect: (id: string) => void
  companies: TransportCompanyDto[]
}

export function TruckList({
  trucks,
  lifecycle,
  search,
  selectedId,
  emptyTitle,
  emptyDescription,
  onSelect,
  companies,
}: TruckListProps) {
  const ordered = [...trucks].sort((left, right) => {
    const byRegistration = left.registration.localeCompare(right.registration, undefined, {
      sensitivity: 'base',
    })

    return (
      byRegistration ||
      left.registration.localeCompare(right.registration) ||
      left.id.localeCompare(right.id)
    )
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {ordered.length > 0 ? (
        <ul
          aria-label={`${lifecycle === 'archived' ? 'Archived' : 'Available'} trucks`}
          className="min-h-0 flex-1 overflow-y-auto p-2"
        >
          {ordered.map((truck) => {
            const selected = truck.id === selectedId
            const company = companies.find((item) => item.id === truck.transportCompanyId)
            const companyName = company?.name ?? 'Unavailable'

            return (
              <li key={truck.id}>
                <button
                  aria-label={`${truck.registration}, ${companyName}`}
                  aria-current={selected ? 'true' : undefined}
                  className={classnames(
                    'w-full cursor-pointer rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    selected && 'border-border bg-muted',
                  )}
                  onClick={() => onSelect(truck.id)}
                  data-truck-id={truck.id}
                  type="button"
                >
                  <span className="block truncate font-medium">
                    <HighlightedText search={search} value={truck.registration} />
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-muted-foreground text-xs">
                    <span className="truncate">
                      <HighlightedText search={search} value={companyName} />
                    </span>
                    {company?.status === 'ARCHIVED' && (
                      <Badge variant="outline">Archived company</Badge>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <Empty className="min-h-52 flex-1 border-0">
          <EmptyHeader>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            <EmptyDescription>{emptyDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  )
}
