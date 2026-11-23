import { ArchiveIcon, ArchiveRestoreIcon, CircleSlashIcon, RotateCcwIcon } from 'lucide-react'
import { useId } from 'react'
import { ResourceActor } from '@/components/resource/resource-actor'
import { formatDateTime } from '@/helpers/dates'
import { LIFECYCLE_PAST_PARTICIPLES, type LifecycleAction } from './lifecycle-copy'
import { type LifecycleBlock, orderLifecycleBlocks } from './resource-lifecycle-summary'

const ACTION_ICONS: Record<LifecycleAction, typeof ArchiveIcon> = {
  archive: ArchiveIcon,
  reactivate: ArchiveRestoreIcon,
  suspend: CircleSlashIcon,
  'return-to-service': RotateCcwIcon,
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

/**
 * The V2 History of a detail sheet: every lifecycle transition the record carries, newest first, as
 * a timeline of what happened, when, who did it, and why.
 *
 * It reads the same `LifecycleBlock`s as `ResourceLifecycleSummary`, which the screens not yet
 * restyled keep using. Unlike that summary, an empty history is said rather than left out: the
 * section is part of the sheet's layout, and its absence would read as a loading gap.
 */
export function ResourceLifecycleHistory({ blocks }: { blocks: LifecycleBlock[] }) {
  const headingId = useId()
  const ordered = orderLifecycleBlocks(blocks)

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3.5">
      <h3 className="font-semibold text-sm" id={headingId}>
        History
      </h3>
      {ordered.length === 0 ? (
        <p className="text-muted-foreground text-sm">No lifecycle history yet.</p>
      ) : (
        <ol className="flex flex-col">
          {ordered.map((block, index) => {
            const Icon = ACTION_ICONS[block.action]
            const isLast = index === ordered.length - 1

            return (
              <li className="relative flex gap-3.5 pb-5 last:pb-0" key={block.action}>
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className="absolute top-8 -bottom-1 left-3.25 w-0.5 bg-border"
                  />
                )}
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                >
                  <Icon className="size-3.5" />
                </span>
                <div className="flex min-w-0 flex-col gap-1.5 pt-0.5">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold text-sm">
                      {capitalize(LIFECYCLE_PAST_PARTICIPLES[block.action])}
                    </span>
                    <span className="text-[13px] text-muted-foreground tabular-nums">
                      {formatDateTime(block.at ?? null)}
                    </span>
                  </div>
                  {/* `undefined` is a collection that never exposes the actor; `null` one that
                      did not resolve it, which is said rather than drawn as an empty dash. */}
                  {block.actor !== undefined && (
                    <span className="text-[13px]">
                      {block.actor ? (
                        <ResourceActor actor={block.actor} />
                      ) : (
                        <span className="text-muted-foreground">Unknown</span>
                      )}
                    </span>
                  )}
                  {block.comment && (
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      “{block.comment}”
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
