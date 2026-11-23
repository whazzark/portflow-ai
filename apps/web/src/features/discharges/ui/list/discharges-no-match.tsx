import { XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import type { DischargeStatusFilter } from '@/features/discharges/types'

type DischargesNoMatchProps = {
  search: string
  status: DischargeStatusFilter
  onClearSearch: () => void
}

/**
 * A search that found nothing in the selected status. It names what was searched and where, and
 * leaves in one action, without claiming the status itself is empty.
 */
export function DischargesNoMatch({ onClearSearch, search, status }: DischargesNoMatchProps) {
  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyTitle>No matching discharges</EmptyTitle>
        <EmptyDescription>
          No {status} discharge matches “{search.trim()}”. Check the vessel name, IMO, dock,
          customer, or product.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onClearSearch} variant="outline">
          <XIcon aria-hidden="true" />
          Clear search
        </Button>
      </EmptyContent>
    </Empty>
  )
}
