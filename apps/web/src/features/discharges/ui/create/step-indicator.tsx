import { CheckIcon } from 'lucide-react'

import {
  CREATION_STEPS,
  type CreationStep,
} from '@/features/discharges/discharge-preparation-schema'
import { classnames } from '@/libraries/shadcn/helpers'

type StepIndicatorProps = {
  current: CreationStep
  /** The furthest step index the user has reached; every step up to it can be opened again. */
  reached: number
  onSelect: (step: CreationStep) => void
}

/**
 * Where a creation stands among its steps. A step already reached opens again on a click, back or
 * forward, without validating anything; a step not reached yet cannot be skipped to.
 */
export function StepIndicator({ current, reached, onSelect }: StepIndicatorProps) {
  const currentIndex = CREATION_STEPS.findIndex((step) => step.id === current)

  return (
    <nav aria-label="Discharge preparation steps" className="flex flex-col gap-2">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {CREATION_STEPS.map((step, index) => {
          const isCurrent = index === currentIndex
          const isDone = index < reached && !isCurrent

          return (
            <li className="flex items-center gap-2" key={step.id}>
              <button
                aria-current={isCurrent ? 'step' : undefined}
                className={classnames(
                  'flex items-center gap-2 rounded-md px-1.5 py-1 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 enabled:hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50',
                  isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
                disabled={index > reached}
                onClick={() => onSelect(step.id)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={classnames(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums',
                    isCurrent && 'border-primary bg-primary text-primary-foreground',
                    isDone && 'border-primary text-primary',
                  )}
                >
                  {isDone ? <CheckIcon className="size-3.5" /> : index + 1}
                </span>
                <span className="max-md:sr-only">{step.label}</span>
                {isDone && <span className="sr-only">, completed</span>}
              </button>
              {index < CREATION_STEPS.length - 1 && (
                <span aria-hidden="true" className="h-px w-4 bg-border md:w-8" />
              )}
            </li>
          )
        })}
      </ol>
      <p aria-hidden="true" className="text-muted-foreground text-sm md:hidden">
        Step {currentIndex + 1} of {CREATION_STEPS.length} · {CREATION_STEPS[currentIndex].label}
      </p>
    </nav>
  )
}
