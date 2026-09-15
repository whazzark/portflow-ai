import { revalidateLogic } from '@tanstack/react-form'
import { Link } from '@tanstack/react-router'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  formatPlannedTime,
  formatTonnes,
  plannedCoverage,
  sumTonnes,
} from '@/features/discharges/discharge-detail-view'
import {
  CREATION_STEPS,
  type CreateDischargeFormValues,
  type CreationStep,
  createDischargeFieldsSchema,
  createDischargeFormDefaults,
  creationCrossRulesSchema,
  creationFieldNames,
  creationStepOf,
  emptyProductLot,
  isStepComplete,
  nextPlannedShift,
  stepHasErrors,
} from '@/features/discharges/discharge-preparation-schema'
import { StepIndicator } from '@/features/discharges/ui/create/step-indicator'
import {
  DischargeIdentityFields,
  ROOT_IDENTITY_FIELDS,
} from '@/features/discharges/ui/preparation/discharge-identity-fields'
import {
  PLANNED_SHIFT_ROW_COLUMNS,
  PlannedShiftFields,
} from '@/features/discharges/ui/preparation/planned-shift-fields'
import type { PreparationOptions } from '@/features/discharges/ui/preparation/preparation-options'
import {
  PRODUCT_LOT_ROW_COLUMNS,
  ProductLotFields,
} from '@/features/discharges/ui/preparation/product-lot-fields'
import { resourceFailureTitle, WRITE_PENDING_LABELS } from '@/helpers/resource-copy'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

type CreateDischargeFormProps = {
  docks: PreparationOptions<{ id: string; name: string }>
  customers: PreparationOptions<{ id: string; name: string }>
  responsibles: PreparationOptions<{ id: string; firstName: string; lastName: string }>
  /**
   * A reason of the page's own to stop the preparation, such as a list of choices loaded empty: no
   * step moves on, as the preparation could not be completed anyway.
   */
  disabled: boolean
  /** The page's title and notices, placed in the form's column above the steps. */
  header: ReactNode
  onSubmit: (values: CreateDischargeFormValues) => Promise<void>
}

const plural = (count: number, singular: string) => `${count} ${singular}${count === 1 ? '' : 's'}`

function SectionCard({
  title,
  description,
  count,
  headingRef,
  children,
}: {
  title: string
  description: string
  count?: ReactNode
  /** Receives the focus when the step this card shows is reached. */
  headingRef: RefObject<HTMLDivElement | null>
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle
          aria-level={2}
          className="text-base outline-none"
          ref={headingRef}
          role="heading"
          tabIndex={-1}
        >
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        {count !== undefined && (
          <CardAction className="text-muted-foreground text-sm tabular-nums">{count}</CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  )
}

/** Column titles above a list of rows; each field keeps its own label for assistive technologies. */
function ColumnHeaders({ columns, titles }: { columns: string; titles: string[] }) {
  return (
    <div
      aria-hidden="true"
      className={`hidden gap-x-3 font-medium text-muted-foreground text-xs md:grid ${columns}`}
    >
      {titles.map((title) => (
        <span key={title}>{title}</span>
      ))}
    </div>
  )
}

/**
 * One row of an array field. A legend names its fieldset only as its first child, so it stays for
 * assistive technologies; the visible title only appears where rows stack, on narrow screens, where
 * the row's trailing action is lifted beside it rather than left alone on a line of its own.
 */
function RepeatedRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="relative flex flex-col gap-2 py-3 md:last:pb-0 md:first:pt-0">
      <legend className="sr-only">{label}</legend>
      <p aria-hidden="true" className="font-medium text-sm md:hidden">
        {label}
      </p>
      {children}
    </fieldset>
  )
}

function RemoveRowButton({
  label,
  canRemove,
  onRemove,
}: {
  label: string
  canRemove: boolean
  onRemove: () => void
}) {
  return (
    <Button
      aria-label={`Remove ${label.toLowerCase()}`}
      disabled={!canRemove}
      onClick={onRemove}
      size="icon"
      type="button"
      variant="ghost"
    >
      <Trash2Icon aria-hidden="true" />
    </Button>
  )
}

export function CreateDischargeForm({
  docks,
  customers,
  responsibles,
  disabled,
  header,
  onSubmit,
}: CreateDischargeFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<CreationStep>('vessel')
  const [reached, setReached] = useState(0)
  // The form's callbacks are created once; they read the step shown when they run from here.
  const stepRef = useRef(step)
  stepRef.current = step
  // Focus moves once the render it waits for is committed: the heading of a step just reached, or
  // the first value in error after a refusal, which may itself have opened another step.
  const [focusRequest, setFocusRequest] = useState<{
    target: 'heading' | 'invalid'
  } | null>(null)
  // The last refusal, until the next submission attempt. TanStack Form keeps a field's errors only
  // while the field is mounted, so each step applies it again when it opens, and a refused value on
  // a step not on screen is shown as soon as the user reaches it.
  const lastRefusalRef = useRef<unknown>(null)

  const indexOf = (target: CreationStep) => CREATION_STEPS.findIndex((item) => item.id === target)
  const lastStep = CREATION_STEPS[CREATION_STEPS.length - 1].id

  const openStep = (target: CreationStep, focus: 'heading' | 'invalid' = 'heading') => {
    setStep(target)
    setReached((previous) => Math.max(previous, indexOf(target)))
    setFocusRequest({ target: focus })
    formRef.current?.parentElement?.scrollIntoView?.({ block: 'start' })
  }

  const advance = () => openStep(CREATION_STEPS[indexOf(stepRef.current) + 1].id)
  const focusFirstInvalid = () => setFocusRequest({ target: 'invalid' })

  const form = useAppForm({
    defaultValues: createDischargeFormDefaults(),
    // A rule across two shifts puts its error on both. Judged on submit, then on every change once
    // a submission was attempted: fixing one shift clears the other's error instead of leaving a
    // stale error that would block the next submission before the rules could run again.
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    // Each field's own rules run on every change, never only on blur: an error recorded while a
    // field was still empty would otherwise surface once it is typed with a valid value, and vanish
    // on leaving it, shifting the rows under the click that left it.
    validators: {
      onChange: createDischargeFieldsSchema,
      onDynamic: creationCrossRulesSchema,
    },
    // Every step submits the form: its validation covers the whole preparation, but only the fields
    // of the step on screen are mounted and touched, so errors of steps not shown yet stay hidden.
    // A step moves on as soon as none of its own fields is in error.
    onSubmitInvalid: ({ formApi }) => {
      lastRefusalRef.current = null
      const current = stepRef.current

      if (current !== lastStep && !stepHasErrors(current, formApi.state.fieldMeta)) {
        advance()

        return
      }

      focusFirstInvalid()
    },
    onSubmit: async ({ value }) => {
      lastRefusalRef.current = null
      // A whole valid preparation still walks to its last step before it can be created.
      if (stepRef.current !== lastStep) {
        advance()

        return
      }

      try {
        await onSubmit(value)
      } catch (error) {
        const refusal = parseApiError(error)
        if (refusal.code === 'E_VALIDATION_ERROR') {
          // The refused values may sit on an earlier step: open the earliest of them, then show
          // the refusal there.
          // Only paths the form renders decide which step opens; an unknown one is announced at
          // form level wherever the user is.
          const renderedFields = new Set(creationFieldNames(value))
          const refusedSteps = (refusal.details ?? [])
            .map((detail) => detail.field.replace(/\.(\d+)(?=\.|$)/g, '[$1]'))
            .filter((field) => renderedFields.has(field))
            .map((field) => indexOf(creationStepOf(field)))
          const target =
            refusedSteps.length > 0 ? CREATION_STEPS[Math.min(...refusedSteps)].id : stepRef.current

          lastRefusalRef.current = error
          if (target === stepRef.current) {
            focusFirstInvalid()
          } else {
            openStep(target, 'invalid')
          }

          return
        } else {
          toast.error(resourceFailureTitle('create', 'discharge', value.vesselName.trim()), {
            description: parseApiError(error).message,
          })
        }
        focusFirstInvalid()
      }
    },
  })

  useEffect(() => {
    if (!focusRequest) {
      return
    }

    const focus = () => {
      if (focusRequest.target === 'heading') {
        headingRef.current?.focus()
      } else {
        // biome-ignore lint/security/noSecrets: an attribute selector, not a secret
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      }
    }

    if (!lastRefusalRef.current) {
      focus()

      return
    }

    // One tick later: the fields of a step just opened validate as they mount, which would wipe a
    // refusal applied in the same commit.
    const timer = setTimeout(() => {
      applyValidationError(form, lastRefusalRef.current, creationFieldNames(form.state.values))
      setTimeout(focus, 0)
    }, 0)

    return () => clearTimeout(timer)
  }, [focusRequest, form])

  const nextLabel = step === lastStep ? '' : `Next: ${CREATION_STEPS[indexOf(step) + 1].label}`

  return (
    <form.AppForm>
      <form.Form className="flex flex-1 flex-col" noValidate={true} ref={formRef}>
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-4 pb-6 md:px-6 md:pt-6">
          {header}
          <StepIndicator
            current={step}
            onSelect={(target) => {
              if (target !== step) {
                openStep(target)
              }
            }}
            reached={reached}
          />

          {step === 'vessel' && (
            <SectionCard
              description="The vessel being unloaded, the dock it berths at, and when the discharge is expected to start."
              headingRef={headingRef}
              title="Vessel and dock"
            >
              <DischargeIdentityFields docks={docks} fields={ROOT_IDENTITY_FIELDS} form={form} />
            </SectionCard>
          )}

          {step === 'lots' && (
            <form.AppField mode="array" name="productLots">
              {(lots) => (
                <SectionCard
                  count={plural(lots.state.value.length, 'lot')}
                  description="Each customer's material the vessel carries, with its expected quantity."
                  headingRef={headingRef}
                  title="Product lots"
                >
                  <ColumnHeaders
                    columns={PRODUCT_LOT_ROW_COLUMNS}
                    titles={['Customer', 'Product', 'Quantity (t)']}
                  />
                  <div className="divide-y">
                    {lots.state.value.map((_, index) => {
                      const label = `Product lot ${index + 1}`

                      return (
                        // biome-ignore lint/suspicious/noArrayIndexKey: array fields are addressed by index
                        <RepeatedRow key={index} label={label}>
                          <ProductLotFields
                            customers={customers}
                            fields={`productLots[${index}]`}
                            form={form}
                            layout="row"
                            trailing={
                              <RemoveRowButton
                                canRemove={lots.state.value.length > 1}
                                label={label}
                                onRemove={() => lots.removeValue(index)}
                              />
                            }
                          />
                        </RepeatedRow>
                      )
                    })}
                  </div>
                  <Button
                    className="self-start"
                    onClick={() => lots.pushValue(emptyProductLot())}
                    type="button"
                    variant="outline"
                  >
                    <PlusIcon aria-hidden="true" />
                    Add product lot
                  </Button>
                </SectionCard>
              )}
            </form.AppField>
          )}

          {step === 'shifts' && (
            <form.AppField mode="array" name="shifts">
              {(shifts) => (
                <SectionCard
                  count={plural(shifts.state.value.length, 'shift')}
                  description="The periods the discharge will be worked, each with its responsible. A new shift starts when the last one ends."
                  headingRef={headingRef}
                  title="Planned shifts"
                >
                  <ColumnHeaders
                    columns={PLANNED_SHIFT_ROW_COLUMNS}
                    titles={['Planned start', 'Planned end', 'Responsible', 'Duration']}
                  />
                  <div className="divide-y">
                    {shifts.state.value.map((_, index) => {
                      const label = `Shift ${index + 1}`

                      return (
                        // biome-ignore lint/suspicious/noArrayIndexKey: array fields are addressed by index
                        <RepeatedRow key={index} label={label}>
                          <PlannedShiftFields
                            fields={`shifts[${index}]`}
                            form={form}
                            responsibles={responsibles}
                            trailing={
                              <RemoveRowButton
                                canRemove={shifts.state.value.length > 1}
                                label={label}
                                onRemove={() => shifts.removeValue(index)}
                              />
                            }
                          />
                        </RepeatedRow>
                      )
                    })}
                  </div>
                  <Button
                    className="self-start"
                    // Read from the form rather than the array field, whose value does not follow a
                    // shift's own dates as they are typed.
                    onClick={() => {
                      const current = form.state.values.shifts

                      shifts.pushValue(nextPlannedShift(current[current.length - 1]))
                    }}
                    type="button"
                    variant="outline"
                  >
                    <PlusIcon aria-hidden="true" />
                    Add shift
                  </Button>
                </SectionCard>
              )}
            </form.AppField>
          )}

          <form.FormError />
        </div>

        {/* Sticky to the bottom of the page: the totals and the way on stay in reach however long
            a step grows. On wide screens its top edge lines up with the separator above the
            sidebar's profile, 64px of content under a 1px border. */}
        <section
          aria-label="Discharge summary"
          className="sticky bottom-0 z-10 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:h-[calc(4rem+1px)] md:pb-0"
        >
          <div className="mx-auto flex h-full w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 md:px-6 md:py-0">
            <form.Subscribe
              selector={(state) => ({
                lots: state.values.productLots.length,
                tonnage: sumTonnes(
                  state.values.productLots.map((lot) => lot.expectedQuantityTonnes),
                ),
                shifts: state.values.shifts.length,
                coverage: plannedCoverage(state.values.shifts),
              })}
            >
              {({ lots, tonnage, shifts, coverage }) => (
                <p className="text-sm tabular-nums">
                  <span className="font-medium">{plural(lots, 'lot')}</span>
                  {' · '}
                  <span className="font-medium">
                    {tonnage === null ? '—' : formatTonnes(tonnage)}
                  </span>
                  {' · '}
                  <span className="font-medium">{plural(shifts, 'shift')}</span>
                  {' · '}
                  <span className="text-muted-foreground">
                    {coverage
                      ? `${formatPlannedTime(coverage.start)} → ${formatPlannedTime(coverage.end)}`
                      : 'No planned period yet'}
                  </span>
                </p>
              )}
            </form.Subscribe>
            <div className="ml-auto flex gap-3">
              <Link
                className={buttonVariants({ variant: 'outline' })}
                from="/discharges/new"
                search={(previous) => previous}
                to="/discharges"
              >
                Cancel
              </Link>
              {step !== CREATION_STEPS[0].id && (
                <Button
                  onClick={() => openStep(CREATION_STEPS[indexOf(step) - 1].id)}
                  type="button"
                  variant="outline"
                >
                  Back
                </Button>
              )}
              {step === lastStep ? (
                <form.SubmitButton disabled={disabled} pendingLabel={WRITE_PENDING_LABELS.create}>
                  Create discharge
                </form.SubmitButton>
              ) : (
                // Moving on is offered only once the step on screen is valid.
                <form.Subscribe selector={(state) => isStepComplete(step, state.values)}>
                  {(isComplete) => (
                    <form.SubmitButton disabled={disabled || !isComplete} pendingLabel={nextLabel}>
                      {nextLabel}
                    </form.SubmitButton>
                  )}
                </form.Subscribe>
              )}
            </div>
          </div>
        </section>
      </form.Form>
    </form.AppForm>
  )
}
