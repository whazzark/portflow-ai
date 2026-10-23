import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { DischargeDto } from '@/features/discharges/types'

const SHOWN_CUSTOMERS = 2

/** The discharge's distinct customers, alphabetically, so a row always shows the same two. */
function customerNames(discharge: DischargeDto) {
  return [...new Set(discharge.productLots.map((productLot) => productLot.customerName))].sort(
    (left, right) => left.localeCompare(right),
  )
}

type DischargeCustomersProps = {
  discharge: DischargeDto
}

/**
 * Two customers and how many more, so a row stays one line whatever the discharge serves. The
 * rest are one hover or focus away, and the trigger's name carries every one of them for a screen
 * reader; a search can match a customer the row does not show.
 */
export function DischargeCustomers({ discharge }: DischargeCustomersProps) {
  const names = customerNames(discharge)

  // A discharge with no lot yet has no customer yet — a real zero, not an unspecified field, so it
  // reads as the same em dash absent values use elsewhere rather than borrowing `Not specified`.
  if (names.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  const shown = names.slice(0, SHOWN_CUSTOMERS).join(', ')
  const remaining = names.length - SHOWN_CUSTOMERS

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate" title={shown}>
        {shown}
      </span>
      {remaining > 0 && (
        <Tooltip>
          <TooltipTrigger
            aria-label={`+${remaining}: ${names.join(', ')}`}
            className="shrink-0 rounded-sm px-1 text-muted-foreground text-xs tabular-nums outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            // The row opens its discharge on click; the trigger only reveals the other customers.
            onClick={(event) => event.stopPropagation()}
            type="button"
          >
            +{remaining}
          </TooltipTrigger>
          <TooltipContent
            className="flex-col items-start"
            // Portalled out of the row, but React still bubbles its clicks through the row.
            onClick={(event) => event.stopPropagation()}
          >
            <ul aria-label="Customers">
              {names.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      )}
    </span>
  )
}
