import { SearchIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

type CustomerTab = 'available' | 'archived'

type CustomerNoMatchProps = {
  term: string
  tab: CustomerTab
  /** Customers of the other tab the same search matches, so a reader looking in the wrong tab is
   * told where the customer went rather than that it does not exist. */
  otherTabMatchCount: number
  onClearSearch: () => void
  onShowOtherTab: () => void
}

const OTHER_TAB: Record<CustomerTab, CustomerTab> = { available: 'archived', archived: 'available' }

export function CustomerNoMatch({
  term,
  tab,
  otherTabMatchCount,
  onClearSearch,
  onShowOtherTab,
}: CustomerNoMatchProps) {
  const otherTab = OTHER_TAB[tab]
  const otherTabSentence =
    otherTabMatchCount > 0
      ? ` ${otherTabMatchCount} ${otherTab} ${otherTabMatchCount === 1 ? 'customer matches' : 'customers match'}.`
      : ''

  return (
    <Empty className="rounded-lg border bg-card py-14">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>
          No {tab} customer matches “{term}”
        </EmptyTitle>
        <EmptyDescription>
          Search looks in customer codes, company names and lifecycle comments.{otherTabSentence}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Button onClick={onClearSearch} variant="outline">
          Clear search
        </Button>
        {otherTabMatchCount > 0 && (
          <Button onClick={onShowOtherTab} variant="ghost">
            Show {otherTab}
          </Button>
        )}
      </EmptyContent>
    </Empty>
  )
}
