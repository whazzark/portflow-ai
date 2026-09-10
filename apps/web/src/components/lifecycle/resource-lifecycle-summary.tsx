import { Fragment, useId } from 'react'
import { ResourceDetailField } from '@/components/resource/resource-details'
import { Separator } from '@/components/ui/separator'
import { formatFullName } from '@/features/users/helpers/name'
import { formatDateTime } from '@/helpers/dates'
import {
  LIFECYCLE_ACTOR_LABELS,
  LIFECYCLE_CONTEXT_HEADINGS,
  LIFECYCLE_TIME_LABELS,
  type LifecycleAction,
} from './lifecycle-copy'

type LifecycleActor = { firstName: string; lastName: string }

export type LifecycleBlock = {
  action: LifecycleAction
  at: string | null | undefined
  /** Omitted where the read contract does not resolve the actor — several collections expose only
   * an id, and restricted collections withhold it entirely. The row is then not rendered. */
  actor?: LifecycleActor | null
  comment: string | null | undefined
}

/** Every transition the record actually carries, newest first. */
export function orderLifecycleBlocks(blocks: LifecycleBlock[]) {
  return blocks
    .filter((block) => Boolean(block.at))
    .sort((left, right) => Date.parse(right.at ?? '') - Date.parse(left.at ?? ''))
}

/**
 * The lifecycle block of a detail pane: when each transition happened, who did it, and why.
 *
 * Every transition the record carries is reported, newest first, rather than the single one its
 * current status implies. A truck just returned to service is AVAILABLE and needs to show both the
 * return and the suspension it ended; deriving one block from the status could only ever show one
 * of them, and for an available record it would show neither. A record with no history at all
 * renders nothing rather than a section of empty rows.
 */
export function ResourceLifecycleSummary({ blocks }: { blocks: LifecycleBlock[] }) {
  const headingId = useId()
  const ordered = orderLifecycleBlocks(blocks)

  if (ordered.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      {ordered.map((block, index) => (
        <Fragment key={block.action}>
          {index > 0 && <Separator />}
          <section aria-labelledby={`${headingId}-${block.action}`} className="flex flex-col gap-3">
            <h3 className="font-medium" id={`${headingId}-${block.action}`}>
              {LIFECYCLE_CONTEXT_HEADINGS[block.action]}
            </h3>
            <dl className="grid gap-4 text-sm">
              <ResourceDetailField
                label={LIFECYCLE_TIME_LABELS[block.action]}
                value={formatDateTime(block.at ?? null)}
              />
              {block.actor !== undefined && (
                <ResourceDetailField
                  label={LIFECYCLE_ACTOR_LABELS[block.action]}
                  value={block.actor ? formatFullName(block.actor) : null}
                />
              )}
              <ResourceDetailField label="Comment" value={block.comment} />
            </dl>
          </section>
        </Fragment>
      ))}
    </div>
  )
}
