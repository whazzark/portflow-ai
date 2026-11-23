import { ChevronDownIcon, ChevronRightIcon, MailIcon, PhoneIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { StatusIndicator } from '@/components/ui/status-indicator'
import { TableCell, TableRow } from '@/components/ui/table'
import type { FleetGroup } from '@/features/transport-resources/helpers/fleet-view'
import { LifecycleContextCell } from './truck-row'

export const FLEET_COLUMN_COUNT = 6

/** Where focus goes back when a company's detail or form closes. */
export function companyNameButtonId(companyId: string) {
  return `company-name-${companyId}`
}

function TruckSummary({ summary }: { summary: FleetGroup['summary'] }) {
  return (
    <span className="text-[13px] text-muted-foreground">
      {summary.suspended > 0
        ? `${summary.available} available · `
        : `${summary.available} available`}
      {summary.suspended > 0 && <span className="text-warning">{summary.suspended} suspended</span>}
    </span>
  )
}

export function CompanyGroupHeader({
  group,
  expanded,
  onToggle,
  onShowOnly,
  actions,
}: {
  group: FleetGroup
  expanded: boolean
  onToggle: () => void
  onShowOnly: () => void
  /** The administrator's group actions; absent in read-only mode. */
  actions?: ReactNode
}) {
  const { company } = group
  const archived = company.status === 'ARCHIVED'
  const Chevron = expanded ? ChevronDownIcon : ChevronRightIcon

  return (
    <TableRow
      className="border-t border-b-0 bg-muted/60 hover:bg-muted/60"
      data-company-id={company.id}
    >
      <TableCell className="h-12 py-0 pr-2.5 pl-2" colSpan={FLEET_COLUMN_COUNT}>
        <div className="flex items-center gap-3">
          <button
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${company.name}`}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onToggle}
            type="button"
          >
            <Chevron aria-hidden="true" className="size-4" />
          </button>
          <button
            aria-label={`Show only ${company.name}`}
            id={companyNameButtonId(company.id)}
            className="rounded-sm font-semibold text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onShowOnly}
            type="button"
          >
            {company.name}
          </button>
          {archived ? (
            <>
              <StatusIndicator label="Archived" variant="neutral" />
              <span className="text-[13px]">
                <LifecycleContextCell
                  actor={company.archivedBy}
                  at={company.archivedAt}
                  comment={company.archiveComment}
                  quoted={true}
                />
              </span>
            </>
          ) : (
            <TruckSummary summary={group.summary} />
          )}
          <span className="flex-1" />
          {!archived && company.contactPhone && (
            <span className="hidden items-center gap-1.5 text-[13px] text-muted-foreground md:inline-flex">
              <PhoneIcon aria-hidden="true" className="size-3.5" />
              {company.contactPhone}
            </span>
          )}
          {!archived && company.contactEmail && (
            <span className="ml-3 hidden items-center gap-1.5 text-[13px] text-muted-foreground md:inline-flex">
              <MailIcon aria-hidden="true" className="size-3.5" />
              {company.contactEmail}
            </span>
          )}
          {actions}
        </div>
      </TableCell>
    </TableRow>
  )
}
