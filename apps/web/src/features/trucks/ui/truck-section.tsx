import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { truckMatchesSearch } from '@/features/trucks/helpers/truck-search'
import type { TruckDto, TruckLifecycle } from '@/features/trucks/types'
import { TruckList } from '@/features/trucks/ui/truck-list'

type TruckSectionProps = {
  trucks: TruckDto[]
  lifecycle: TruckLifecycle
  search: string
  selectedId?: string
  onSelect: (id: string) => void
  companies: TransportCompanyDto[]
  selectable?: boolean
  selectedIds?: ReadonlySet<string>
  onSelectionChange?: (checked: boolean, ids: string[]) => void
  canAdminister?: boolean
  onEdit?: (id: string) => void
  onView?: (id: string) => void
  onCreate?: () => void
}

export function TruckSection({
  trucks,
  lifecycle,
  search,
  selectedId,
  onSelect,
  companies,
  selectable,
  selectedIds,
  onSelectionChange,
  canAdminister,
  onEdit,
  onView,
  onCreate,
}: TruckSectionProps) {
  const lifecycleLabel =
    lifecycle === 'archived' ? 'Archived' : lifecycle === 'suspended' ? 'Suspended' : 'Available'
  const matches = trucks.filter((truck) =>
    truckMatchesSearch(
      truck,
      companies.find((company) => company.id === truck.transportCompanyId),
      search,
    ),
  )
  const hasSearch = search.trim().length > 0

  return (
    <section aria-label={`${lifecycleLabel} trucks`} className="flex h-full min-h-0">
      <TruckList
        trucks={matches}
        canAdminister={canAdminister}
        companies={companies}
        emptyDescription={
          hasSearch
            ? 'Try a different registration or transport-company name.'
            : 'No trucks exist in this lifecycle state.'
        }
        emptyTitle={hasSearch ? 'No matching trucks' : `No ${lifecycle} trucks`}
        lifecycle={lifecycle}
        onCreate={hasSearch ? undefined : onCreate}
        onEdit={onEdit}
        onSelect={onSelect}
        onSelectionChange={onSelectionChange}
        onView={onView}
        search={search}
        selectable={selectable}
        selectedId={selectedId}
        selectedIds={selectedIds}
      />
    </section>
  )
}
