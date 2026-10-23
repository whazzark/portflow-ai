import type { OnChangeFn, SortingState } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { customerMatchesSearch } from '@/features/customers/helpers/customer-search'
import type { CustomerDto } from '@/features/customers/types'
import { CustomerNoMatch } from '@/features/customers/ui/customer-no-match'
import { CustomerTable } from '@/features/customers/ui/customer-table'

type CustomerSectionProps = {
  customers: CustomerDto[]
  isArchived: boolean
  onSelect: (customerId: string) => void
  onEdit: (customerId: string) => void
  search: string
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  canAdminister: boolean
  selectedIds: ReadonlySet<string>
  onSelectionChange: (customerIds: string[]) => void
  otherTabMatchCount: number
  onClearSearch: () => void
  onShowOtherTab: () => void
  onCreate: () => void
}

export function CustomerSection({
  customers,
  isArchived,
  onSelect,
  onEdit,
  search,
  sorting,
  onSortingChange,
  canAdminister,
  selectedIds,
  onSelectionChange,
  otherTabMatchCount,
  onClearSearch,
  onShowOtherTab,
  onCreate,
}: CustomerSectionProps) {
  const tab = isArchived ? 'archived' : 'available'
  const hasNoMatch =
    search.trim() !== '' && !customers.some((customer) => customerMatchesSearch(customer, search))

  return (
    // Full height rather than a capped one: the table below caps itself at `md:max-h-full`, and a
    // percentage max-height only resolves against a parent whose own height is definite.
    <section
      className="md:h-full md:min-h-0"
      aria-label={isArchived ? 'Archived customers' : 'Available customers'}
    >
      {hasNoMatch ? (
        <CustomerNoMatch
          onClearSearch={onClearSearch}
          onShowOtherTab={onShowOtherTab}
          otherTabMatchCount={otherTabMatchCount}
          tab={tab}
          term={search.trim()}
        />
      ) : (
        <CustomerTable
          customers={customers}
          emptyAction={
            canAdminister && !isArchived ? (
              <Button onClick={onCreate}>
                <PlusIcon aria-hidden="true" />
                Create customer
              </Button>
            ) : undefined
          }
          emptyDescription={
            isArchived ? 'No customer has been archived.' : 'No customers have been added yet.'
          }
          emptyTitle={`No ${tab} customers`}
          isArchived={isArchived}
          onEdit={onEdit}
          onSelect={onSelect}
          onSortingChange={onSortingChange}
          search={search}
          sorting={sorting}
          canAdminister={canAdminister}
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
        />
      )}
    </section>
  )
}
