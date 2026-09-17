import { type ReactNode, useState } from 'react'

import { buttonVariants } from '@/components/ui/button'
import {
  lotHoldingDoor,
  lotLabel,
  shiftDoorOptions,
} from '@/features/discharges/discharge-planning-view'
import {
  formatLocalShiftDuration,
  type ShiftCorrectionFormValues,
} from '@/features/discharges/discharge-preparation-schema'
import { heldPoolEntries, offeredShiftTrucks } from '@/features/discharges/truck-pool-selection'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { DischargeTabLink } from '@/features/discharges/ui/detail/discharge-tab-link'
import { ReferenceLabel } from '@/features/discharges/ui/detail/reference-label'
import {
  type ChecklistRow,
  ShiftResourceChecklist,
} from '@/features/discharges/ui/detail/shift-resource-checklist'
import { useResourceRows } from '@/features/discharges/ui/detail/use-resource-rows'
import {
  useResponsibleOptions,
  useWeighingAreaOptions,
} from '@/features/discharges/ui/preparation/preparation-options'
import { withFieldGroup } from '@/libraries/forms/form'

type Shift = DischargeDetailDto['shifts'][number]
type Responsible = Shift['responsible']

export type ShiftResourceList = 'truckIds' | 'warehouseDoorIds' | 'weighingAreaIds'
export type ShiftResourceRefusals = Record<ShiftResourceList, ReadonlyMap<string, string>>

export const NO_SHIFT_RESOURCE_REFUSALS: ShiftResourceRefusals = {
  truckIds: new Map(),
  warehouseDoorIds: new Map(),
  weighingAreaIds: new Map(),
}

export const SHIFT_RESOURCE_REFUSAL_TITLES: Record<ShiftResourceList, string> = {
  truckIds: 'Some trucks can no longer be selected',
  warehouseDoorIds: 'Some warehouse doors can no longer be selected',
  weighingAreaIds: 'Some weighing areas can no longer be selected',
}

const periodDefaults: Pick<
  ShiftCorrectionFormValues,
  'plannedStartAt' | 'plannedEndAt' | 'responsibleUserId'
> = { plannedStartAt: '', plannedEndAt: '', responsibleUserId: '' }

/**
 * A shift's responsible, its duration, and its planned period, as the shift panel's forms lay them
 * out. `kept` is a responsible the shift already has who is no longer offered, so it stays readable.
 */
export const ShiftPeriodFields = withFieldGroup({
  defaultValues: periodDefaults,
  props: { kept: undefined as Responsible | undefined },
  render: function ShiftPeriodFieldsRender({ group, kept }) {
    const responsibles = useResponsibleOptions()
    const options = [
      ...(kept && !responsibles.options.some((option) => option.id === kept.id) ? [kept] : []),
      ...responsibles.options,
    ]

    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <group.AppField name="responsibleUserId">
            {(field) => (
              <field.ComboboxField
                emptyMessage="No responsible matches"
                label="Responsible"
                loading={responsibles.loading}
                onRetry={responsibles.onRetry}
                options={options.map((responsible) => ({
                  label: `${responsible.firstName} ${responsible.lastName}`,
                  value: responsible.id,
                }))}
                placeholder="Search a responsible"
                required={true}
              />
            )}
          </group.AppField>
        </div>
        <group.Subscribe
          selector={(state) =>
            formatLocalShiftDuration(state.values.plannedStartAt, state.values.plannedEndAt)
          }
        >
          {(length) => (
            <p className="text-muted-foreground text-sm tabular-nums sm:col-span-2">
              Duration {length}
            </p>
          )}
        </group.Subscribe>
        <group.AppField name="plannedStartAt">
          {(field) => <field.DateTimeField label="Planned start" required={true} />}
        </group.AppField>
        <group.AppField name="plannedEndAt">
          {(field) => <field.DateTimeField label="Planned end" required={true} />}
        </group.AppField>
      </div>
    )
  },
})

const resourceDefaults: Pick<ShiftCorrectionFormValues, ShiftResourceList> = {
  truckIds: [],
  warehouseDoorIds: [],
  weighingAreaIds: [],
}

/**
 * The weighing areas, warehouse doors, and trucks a planned shift of a planned discharge uses, as the
 * shift panel's forms choose them: what the shift already holds stays listed and may be let go of,
 * and only what may be newly selected is offered. `shift` is the shift being corrected, or nothing
 * for a shift being added, which holds nothing yet.
 */
export const ShiftResourceFields = withFieldGroup({
  defaultValues: resourceDefaults,
  props: {
    discharge: undefined as unknown as DischargeDetailDto,
    shift: undefined as Shift | undefined,
    refusals: NO_SHIFT_RESOURCE_REFUSALS as ShiftResourceRefusals,
    /** Called before a link leaves the panel for another section. */
    onLeave: (() => {}) as () => void,
  },
  render: function ShiftResourceFieldsRender({ group, discharge, shift, refusals, onLeave }) {
    const areas = useWeighingAreaOptions()

    // Fixed when the form opens, so a refreshed detail never moves a row under the user's pointer.
    const [trucks] = useState(() => offeredShiftTrucks(discharge, shift?.id ?? ''))
    const [currentDoors] = useState<ChecklistRow[]>(() =>
      (shift?.warehouseDoors ?? [])
        .filter((membership) => membership.effectiveTo === null)
        .map((membership) => ({
          id: membership.warehouseDoor.id,
          name: `${membership.warehouse.name} › ${membership.warehouseDoor.name}`,
          label: doorLabel(membership.warehouse, membership.warehouseDoor),
          description: doorHolderDescription(discharge, membership.warehouseDoor.id),
          canCheck: false,
        })),
    )
    const [currentAreas] = useState<ChecklistRow[]>(() =>
      (shift?.weighingAreas ?? [])
        .filter((membership) => membership.effectiveTo === null)
        .map((membership) => ({
          id: membership.weighingArea.id,
          name: membership.weighingArea.name,
          label: (
            <ReferenceLabel
              name={membership.weighingArea.name}
              status={membership.weighingArea.status}
            />
          ),
          canCheck: false,
        })),
    )

    // A refused truck the refreshed pool no longer holds stays listed so its reason is readable, but
    // like a suspended one it may only be let go of.
    const heldNow = new Set(heldPoolEntries(discharge).map((entry) => entry.truckId))
    const truckRows: ChecklistRow[] = trucks.map((truck) => ({
      id: truck.truckId,
      name: truck.registration,
      label: <ReferenceLabel name={truck.registration} status={truck.truckStatus} />,
      canCheck:
        truck.canCheck && !(refusals.truckIds.has(truck.truckId) && !heldNow.has(truck.truckId)),
    }))

    return (
      <>
        <group.AppField name="weighingAreaIds">
          {(field) => (
            <ResourceField
              current={currentAreas}
              empty={<p className="text-muted-foreground text-sm">No weighing area available</p>}
              label="Weighing areas"
              loading={areas.loading}
              lockedNote="Archived weighing areas cannot be newly selected"
              offered={areas.options.map((area) => ({
                id: area.id,
                name: area.name,
                label: <ReferenceLabel name={area.name} status={area.status} />,
                canCheck: true,
              }))}
              onChange={field.handleChange}
              onRetry={areas.onRetry}
              reasons={refusals.weighingAreaIds}
              selected={field.state.value}
            />
          )}
        </group.AppField>
        <group.AppField name="warehouseDoorIds">
          {(field) => (
            <ResourceField
              current={currentDoors}
              empty={
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    No door is assigned to a product lot
                  </span>
                  {/* A shift only uses doors its discharge's lots hold, so they are assigned there. */}
                  <DischargeTabLink
                    className={buttonVariants({ size: 'sm', variant: 'outline' })}
                    onClick={onLeave}
                    tab="product-lots"
                  >
                    Go to product lots
                  </DischargeTabLink>
                </div>
              }
              label="Warehouse doors"
              lockedNote="Archived doors and doors no lot holds cannot be newly selected"
              offered={shiftDoorOptions(discharge)
                .filter((option) => option.canCheck)
                .map((option) => ({
                  id: option.id,
                  name: option.name,
                  label: doorLabel(option.warehouse, option.warehouseDoor),
                  description: lotLabel(option.lot),
                  canCheck: true,
                }))}
              onChange={field.handleChange}
              reasons={refusals.warehouseDoorIds}
              selected={field.state.value}
            />
          )}
        </group.AppField>
        <group.AppField name="truckIds">
          {(field) => (
            <ShiftResourceChecklist
              empty={
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">No trucks reserved</span>
                  {/* The panel lets go of focus before its section is left. */}
                  <DischargeTabLink
                    className={buttonVariants({ size: 'sm', variant: 'outline' })}
                    onClick={onLeave}
                    tab="truck-pool"
                  >
                    Go to truck pool
                  </DischargeTabLink>
                </div>
              }
              label="Trucks"
              lockedNote="Suspended trucks cannot be newly selected"
              onChange={field.handleChange}
              reasons={refusals.truckIds}
              rows={truckRows}
              selected={field.state.value}
            />
          )}
        </group.AppField>
      </>
    )
  },
})

function doorLabel(
  warehouse: { name: string; status: 'AVAILABLE' | 'ARCHIVED' },
  door: { name: string; status: 'AVAILABLE' | 'ARCHIVED' },
) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <ReferenceLabel name={warehouse.name} status={warehouse.status} />
      {' › '}
      <ReferenceLabel name={door.name} status={door.status} />
    </span>
  )
}

/** The lot holding a door the shift selected, or that none does any more. */
function doorHolderDescription(discharge: DischargeDetailDto, doorId: string) {
  const holder = lotHoldingDoor(discharge, doorId)

  return holder ? lotLabel(holder) : 'No lot holds this door'
}

function ResourceField({
  current,
  offered,
  selected,
  ...props
}: {
  current: ChecklistRow[]
  offered: ChecklistRow[]
  selected: readonly string[]
  empty: ReactNode
  label: string
  lockedNote: string
  loading?: boolean
  onRetry?: () => void
  onChange: (ids: string[]) => void
  reasons: ReadonlyMap<string, string>
}) {
  const rows = useResourceRows(current, offered, selected)

  return <ShiftResourceChecklist {...props} rows={rows} selected={[...selected]} />
}
