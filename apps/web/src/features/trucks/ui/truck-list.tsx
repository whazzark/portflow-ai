import { HighlightedText } from '@/components/highlighted-text'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import type { TruckDto, TruckLifecycle } from '@/features/trucks/types'
import { TruckRowActions } from '@/features/trucks/ui/truck-row-actions'
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
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (checked: boolean, ids: string[]) => void
  canAdminister?: boolean
  onEdit?: (id: string) => void
  onView?: (id: string) => void
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
  selectable = false,
  selectedIds = new Set(),
  onSelectionChange,
  canAdminister = false,
  onEdit,
  onView,
}: TruckListProps) {
  const lifecycleLabel =
    lifecycle === 'archived' ? 'Archived' : lifecycle === 'suspended' ? 'Suspended' : 'Available'
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

  const visibleIds = ordered.map((truck) => truck.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const someSelected = visibleIds.some((id) => selectedIds.has(id))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {ordered.length > 0 ? (
        <>
          {selectable && (
            <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
              <Checkbox
                aria-checked={someSelected && !allSelected ? 'mixed' : allSelected}
                aria-label={`Select all ${lifecycle} trucks`}
                checked={allSelected}
                onCheckedChange={(checked) => onSelectionChange?.(checked === true, visibleIds)}
              />
              <span className="text-muted-foreground text-xs">Select all</span>
            </div>
          )}
          <ul
            aria-label={`${lifecycleLabel} trucks`}
            className="min-h-0 flex-1 overflow-y-auto p-2"
          >
            {ordered.map((truck) => {
              const selected = truck.id === selectedId
              const company = companies.find((item) => item.id === truck.transportCompanyId)
              const companyName = company?.name ?? 'Unavailable'

              return (
                <li className="flex items-center gap-1" key={truck.id}>
                  {selectable && (
                    <Checkbox
                      aria-label={`Select truck ${truck.registration}`}
                      checked={selectedIds.has(truck.id)}
                      onCheckedChange={(checked) =>
                        onSelectionChange?.(checked === true, [truck.id])
                      }
                    />
                  )}
                  <button
                    aria-label={`${truck.registration}, ${companyName}`}
                    aria-current={selected ? 'true' : undefined}
                    className={classnames(
                      'min-w-0 flex-1 cursor-pointer rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
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
                  {canAdminister && (
                    <TruckRowActions onEdit={onEdit} onView={onView} truck={truck} />
                  )}
                </li>
              )
            })}
          </ul>
        </>
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
