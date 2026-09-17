import { useId } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import type { StartReview } from '@/features/discharges/discharge-start-view'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { ReferenceLabel } from '@/features/discharges/ui/detail/reference-label'

type StartReviewProps = {
  discharge: DischargeDetailDto
  review: StartReview
  /** Until the check names the shift to start, the review does not guess which one it is. */
  checking: boolean
}

function List({ items, empty }: { items: string[]; empty: string }) {
  return items.length > 0 ? (
    <ul className="grid gap-0.5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  ) : (
    <p className="text-muted-foreground">{empty}</p>
  )
}

/** The preparation the start confirmation shows before anything changes. */
export function StartReviewContent({ checking, discharge, review }: StartReviewProps) {
  const shiftHeadingId = useId()
  const lotsHeadingId = useId()

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section aria-labelledby={lotsHeadingId} className="grid content-start gap-3">
        <h3 className="font-medium" id={lotsHeadingId}>
          Product lots
        </h3>
        <dl className="grid gap-1 text-muted-foreground">
          <div className="flex gap-1.5">
            <dt>Dock</dt>
            <dd className="font-medium text-foreground">
              <ReferenceLabel name={discharge.dock.name} status={discharge.dock.status} />
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Truck pool</dt>
            <dd className="font-medium text-foreground">
              {review.heldTrucks === 1 ? '1 truck held' : `${review.heldTrucks} trucks held`}
            </dd>
          </div>
        </dl>
        <ul className="grid gap-3">
          {review.customers.map(({ customer, lots }) => (
            <li className="grid gap-1" key={customer.id}>
              <p className="font-medium">
                <ReferenceLabel name={customer.name} status={customer.status} />
              </p>
              <ul className="grid gap-2 pl-3">
                {lots.map((lot) => (
                  <li className="grid gap-0.5" key={lot.id}>
                    <p>{lot.productName}</p>
                    <div className="text-muted-foreground">
                      <List
                        empty="No warehouse door"
                        items={lot.doors.map((door) => `${door.door} · ${door.warehouse}`)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby={shiftHeadingId} className="grid content-start gap-3">
        <h3 className="font-medium" id={shiftHeadingId}>
          Shift to start
        </h3>
        {checking ? (
          <Skeleton aria-label="Checking the shift to start" className="h-20 w-full" />
        ) : review.shift ? (
          <dl className="grid gap-3">
            <div className="grid gap-0.5">
              <dt className="text-muted-foreground">Planned</dt>
              <dd>{review.shift.label}</dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-muted-foreground">Responsible</dt>
              <dd>{review.shift.responsible}</dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-muted-foreground">Trucks</dt>
              <dd>
                <List
                  empty="No truck"
                  items={review.shift.trucks.map((truck) =>
                    truck.suspended ? `${truck.registration} (suspended)` : truck.registration,
                  )}
                />
              </dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-muted-foreground">Warehouse doors</dt>
              <dd>
                <List
                  empty="No warehouse door"
                  items={review.shift.doors.map((door) => `${door.door} · ${door.warehouse}`)}
                />
              </dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-muted-foreground">Weighing areas</dt>
              <dd>
                <List
                  empty="No weighing area"
                  items={review.shift.weighingAreas.map((area) => area.name)}
                />
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-muted-foreground">No planned shift</p>
        )}
      </section>
    </div>
  )
}
