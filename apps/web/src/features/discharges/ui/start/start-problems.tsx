import { Link } from '@tanstack/react-router'
import { ChevronRightIcon, TriangleAlertIcon } from 'lucide-react'
import { type ReactNode, type Ref, useId } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { shiftSearch, tabSearch } from '@/features/discharges/discharge-detail-sections'
import {
  type StartProblemLink,
  type StartProblemSection,
  startProblemSections,
} from '@/features/discharges/discharge-start-view'
import type { DischargeDetailDto, StartProblemDto } from '@/features/discharges/types'

type StartProblemsProps = {
  discharge: DischargeDetailDto
  problems: StartProblemDto[]
  alertRef: Ref<HTMLDivElement>
  /** Following a problem leaves the confirmation for where it is fixed. */
  onNavigate: () => void
}

const INLINE_LINK_CLASS = 'font-medium text-foreground underline underline-offset-4'

type ProblemLinkProps = {
  link: StartProblemLink
  onNavigate: () => void
  children: ReactNode
  className?: string
  'aria-label'?: string
}

/** A section of this discharge, a shift of it, or the discharge holding a resource. */
function ProblemLink({ link, onNavigate, children, ...props }: ProblemLinkProps) {
  if (link.kind === 'discharge') {
    return (
      <Link
        {...props}
        from="/discharges/$dischargeId"
        onClick={onNavigate}
        params={{ dischargeId: link.dischargeId }}
        // The list state the way back restores is kept, as it is between two sections.
        search={(previous) => ({ ...previous, ...tabSearch(link.tab) })}
        to="/discharges/$dischargeId"
      >
        {children}
      </Link>
    )
  }

  return (
    <Link
      {...props}
      from="/discharges/$dischargeId"
      onClick={onNavigate}
      search={(previous) => ({
        ...previous,
        ...(link.shiftId ? shiftSearch(link.shiftId) : tabSearch(link.tab)),
      })}
      to="."
    >
      {children}
    </Link>
  )
}

function ProblemSection({
  section,
  onNavigate,
}: {
  section: StartProblemSection
  onNavigate: () => void
}) {
  const headingId = useId()

  return (
    <section aria-labelledby={headingId} className="grid gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium" id={headingId}>
          {section.title}
        </h3>
        <ProblemLink
          aria-label={`Open ${section.title}`}
          className={buttonVariants({ size: 'sm', variant: 'ghost' })}
          link={section.link}
          onNavigate={onNavigate}
        >
          Open
          <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
        </ProblemLink>
      </div>
      <ul className="grid gap-2">
        {section.items.map((item) => (
          <li className="grid gap-0.5" key={item.key}>
            {item.heading &&
              (item.heading.link ? (
                <ProblemLink
                  className="w-fit font-medium hover:underline hover:underline-offset-4"
                  link={item.heading.link}
                  onNavigate={onNavigate}
                >
                  {item.heading.text}
                </ProblemLink>
              ) : (
                <p className="font-medium">{item.heading.text}</p>
              ))}
            <ul className={item.heading ? 'grid gap-0.5 pl-3' : 'grid gap-0.5'}>
              {item.lines.map((line, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: two unknown subjects can share a wording
                <li className="text-muted-foreground" key={`${line.text}-${index}`}>
                  {line.text}
                  {line.holder && (
                    <>
                      {' '}
                      <ProblemLink
                        className={INLINE_LINK_CLASS}
                        link={line.holder.link}
                        onNavigate={onNavigate}
                      >
                        {line.holder.vesselName}
                      </ProblemLink>
                    </>
                  )}
                  {line.detail && <span className="block text-xs">{line.detail}</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Why the discharge cannot start: how many problems there are, then each kind of element in the
 * detail's section order with what is wrong with it, so the user reads the plan as the detail shows it.
 */
export function StartProblems({ alertRef, discharge, onNavigate, problems }: StartProblemsProps) {
  return (
    <div className="grid gap-3">
      <Alert ref={alertRef} tabIndex={-1} variant="destructive">
        <TriangleAlertIcon aria-hidden="true" />
        <AlertTitle>This discharge cannot start yet</AlertTitle>
        <AlertDescription>
          {problems.length === 1 ? '1 problem to fix' : `${problems.length} problems to fix`}
        </AlertDescription>
      </Alert>
      {startProblemSections(problems, discharge).map((section) => (
        <ProblemSection key={section.key} onNavigate={onNavigate} section={section} />
      ))}
    </div>
  )
}
