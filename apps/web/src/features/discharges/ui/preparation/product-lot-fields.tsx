import { FieldGroup } from '@/components/ui/field'
import {
  emptyProductLot,
  type ProductLotFormValues,
} from '@/features/discharges/discharge-preparation-schema'
import type { PreparationOptions } from '@/features/discharges/ui/preparation/preparation-options'
import { withFieldGroup } from '@/libraries/forms/form'

type CustomerOption = { id: string; name: string }

/**
 * One product lot's customer, product name, expected quantity, and description, one field under the
 * other, as a lot is corrected on its own.
 */
export const ProductLotFields = withFieldGroup({
  defaultValues: emptyProductLot() as ProductLotFormValues,
  props: {
    customers: { options: [], loading: false } as PreparationOptions<CustomerOption>,
  },
  render: function ProductLotFieldsRender({ group, customers }) {
    return (
      <FieldGroup>
        <group.AppField name="customerId">
          {(field) => (
            <field.ComboboxField
              emptyMessage="No customer matches"
              label="Customer"
              loading={customers.loading}
              onRetry={customers.onRetry}
              options={customers.options.map((option) => ({
                label: option.name,
                value: option.id,
              }))}
              placeholder="Search a customer"
              required={true}
            />
          )}
        </group.AppField>
        <group.AppField name="productName">
          {(field) => <field.TextField autoComplete="off" label="Product name" required={true} />}
        </group.AppField>
        <group.AppField name="expectedQuantityTonnes">
          {(field) => (
            <field.TextField
              autoComplete="off"
              inputMode="decimal"
              label="Expected quantity (t)"
              required={true}
            />
          )}
        </group.AppField>
        <group.AppField name="description">
          {(field) => <field.TextareaField label="Description" />}
        </group.AppField>
      </FieldGroup>
    )
  },
})
