import type { DischargeIdentityFormValues } from '@/features/discharges/discharge-preparation-schema'
import type { PreparationOptions } from '@/features/discharges/ui/preparation/preparation-options'
import { withFieldGroup } from '@/libraries/forms/form'

type DockOption = { id: string; name: string }

const defaultValues: DischargeIdentityFormValues = {
  vesselName: '',
  vesselImo: '',
  vesselComment: '',
  dockId: '',
  expectedStartAt: '',
}

/** Mapping for a form whose identity fields sit at its root, as creation and correction both do. */
export const ROOT_IDENTITY_FIELDS = {
  vesselName: 'vesselName',
  vesselImo: 'vesselImo',
  vesselComment: 'vesselComment',
  dockId: 'dockId',
  expectedStartAt: 'expectedStartAt',
} as const

/**
 * The vessel, dock, and expected start of a discharge, as creation enters them and a correction
 * edits them. The options come from the caller, which also owns submission.
 */
export const DischargeIdentityFields = withFieldGroup({
  defaultValues,
  props: { docks: { options: [], loading: false } as PreparationOptions<DockOption> },
  render: function DischargeIdentityFieldsRender({ group, docks }) {
    return (
      // Two columns pair the vessel with its IMO and the dock with the expected start; the comment,
      // free text, keeps the full width.
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        <group.AppField name="vesselName">
          {(field) => <field.TextField autoComplete="off" label="Vessel name" required={true} />}
        </group.AppField>
        <group.AppField name="vesselImo">
          {(field) => (
            <field.TextField
              autoComplete="off"
              inputMode="numeric"
              label="IMO number"
              placeholder="7 digits, when known"
            />
          )}
        </group.AppField>
        <group.AppField name="dockId">
          {(field) => (
            <field.ComboboxField
              emptyMessage="No dock matches"
              label="Dock"
              loading={docks.loading}
              onRetry={docks.onRetry}
              options={docks.options.map((dock) => ({ label: dock.name, value: dock.id }))}
              placeholder="Search a dock"
              required={true}
            />
          )}
        </group.AppField>
        <group.AppField name="expectedStartAt">
          {(field) => <field.DateTimeField label="Expected start" required={true} />}
        </group.AppField>
        <div className="sm:col-span-2">
          <group.AppField name="vesselComment">
            {(field) => <field.TextareaField label="Vessel comment" rows={2} />}
          </group.AppField>
        </div>
      </div>
    )
  },
})
