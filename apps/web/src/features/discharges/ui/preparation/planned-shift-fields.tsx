import type { ReactNode } from 'react'

import {
  emptyPlannedShift,
  formatLocalShiftDuration,
  type PlannedShiftFormValues,
} from '@/features/discharges/discharge-preparation-schema'
import type { PreparationOptions } from '@/features/discharges/ui/preparation/preparation-options'
import { withFieldGroup } from '@/libraries/forms/form'

type ResponsibleOption = { id: string; firstName: string; lastName: string }

/** The row's grid, shared with the column headers so both line up. */
export const PLANNED_SHIFT_ROW_COLUMNS =
  'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_4.5rem_2.25rem]'

/**
 * One planned shift on one line under column headers: its period, its responsible, and its
 * duration. Below `md` the fields stack with their own labels.
 */
export const PlannedShiftFields = withFieldGroup({
  defaultValues: emptyPlannedShift() as PlannedShiftFormValues,
  props: {
    responsibles: { options: [], loading: false } as PreparationOptions<ResponsibleOption>,
    /** Rendered at the row's end, such as its remove button. */
    trailing: undefined as ReactNode,
  },
  render: function PlannedShiftFieldsRender({ group, responsibles, trailing }) {
    return (
      <div className={`grid gap-x-3 gap-y-3 md:items-start ${PLANNED_SHIFT_ROW_COLUMNS}`}>
        <group.AppField name="plannedStartAt">
          {(field) => (
            <field.DateTimeField
              label="Planned start"
              labelClassName="md:sr-only"
              required={true}
            />
          )}
        </group.AppField>
        <group.AppField name="plannedEndAt">
          {(field) => (
            <field.DateTimeField label="Planned end" labelClassName="md:sr-only" required={true} />
          )}
        </group.AppField>
        <group.AppField name="responsibleUserId">
          {(field) => (
            <field.ComboboxField
              emptyMessage="No responsible matches"
              label="Responsible"
              labelClassName="md:sr-only"
              loading={responsibles.loading}
              onRetry={responsibles.onRetry}
              options={responsibles.options.map((responsible) => ({
                label: `${responsible.firstName} ${responsible.lastName}`,
                value: responsible.id,
              }))}
              placeholder="Search a responsible"
              required={true}
            />
          )}
        </group.AppField>
        <group.Subscribe
          selector={(state) =>
            formatLocalShiftDuration(state.values.plannedStartAt, state.values.plannedEndAt)
          }
        >
          {(length) => (
            <p className="flex h-8 items-center text-muted-foreground text-sm tabular-nums">
              <span className="md:sr-only">Duration&nbsp;</span>
              {length}
            </p>
          )}
        </group.Subscribe>
        <div className="flex justify-end max-md:absolute max-md:top-1.5 max-md:right-0">
          {trailing}
        </div>
      </div>
    )
  },
})
