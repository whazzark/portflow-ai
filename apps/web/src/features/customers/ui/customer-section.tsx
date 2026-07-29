import type { OnChangeFn, SortingState } from '@tanstack/react-table'
import type { CustomerDto } from '@/features/customers/types'
import { CustomerTable } from '@/features/customers/ui/customer-table'

type CustomerSectionProps = {
  customers: CustomerDto[]
  isArchived: boolean
  onSelect: (customerId: string) => void
  search: string
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  canAdminister: boolean
  selectedIds: Set<string>
  onSelectionChange: (customerIds: string[]) => void
}

export function CustomerSection({
  customers,
  isArchived,
  onSelect,
  search,
  sorting,
  onSortingChange,
  canAdminister,
  selectedIds,
  onSelectionChange,
}: CustomerSectionProps) {
  return (
    <section
      className="md:h-full md:min-h-0"
      aria-label={isArchived ? 'Archived customers' : 'Available customers'}
    >
      <CustomerTable
        customers={customers}
        emptyDescription={search ? 'Try a different search.' : 'No customers have been added yet.'}
        emptyTitle={
          search ? 'No matching customers' : `No ${isArchived ? 'archived' : 'available'} customers`
        }
        isArchived={isArchived}
        onSelect={onSelect}
        onSortingChange={onSortingChange}
        search={search}
        sorting={sorting}
        canAdminister={canAdminister}
        selectedIds={selectedIds}
        onSelectionChange={onSelectionChange}
      />
    </section>
  )
}
