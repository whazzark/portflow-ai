import { PlusIcon } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import {
  emptyProductLot,
  type ProductLotFormValues,
} from '@/features/discharges/discharge-preparation-schema'
import type { PreparationOptions } from '@/features/discharges/ui/preparation/preparation-options'
import { withFieldGroup } from '@/libraries/forms/form'

type CustomerOption = { id: string; name: string }

/** The row's grid, shared with the column headers so both line up. */
export const PRODUCT_LOT_ROW_COLUMNS = 'md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_8rem_2.25rem]'

/**
 * One product lot's customer, product name, expected quantity, and description, as creation lists
 * them and as a lot is added or corrected on its own.
 *
 * - `stacked` puts one field under the other, for a lot edited on its own in a sheet.
 * - `row` puts customer, product, and quantity on one line under column headers, for the list of
 *   lots a creation carries; the optional description opens below it on demand.
 */
export const ProductLotFields = withFieldGroup({
  defaultValues: emptyProductLot() as ProductLotFormValues,
  props: {
    customers: { options: [], loading: false } as PreparationOptions<CustomerOption>,
    layout: 'stacked' as 'stacked' | 'row',
    /** Rendered at the row's end, such as its remove button. */
    trailing: undefined as ReactNode,
  },
  render: function ProductLotFieldsRender({ group, customers, layout, trailing }) {
    const isRow = layout === 'row'
    const labelClassName = isRow ? 'md:sr-only' : undefined

    const customer = (
      <group.AppField name="customerId">
        {(field) => (
          <field.ComboboxField
            emptyMessage="No customer matches"
            label="Customer"
            labelClassName={labelClassName}
            loading={customers.loading}
            onRetry={customers.onRetry}
            options={customers.options.map((option) => ({ label: option.name, value: option.id }))}
            placeholder="Search a customer"
            required={true}
          />
        )}
      </group.AppField>
    )
    const productName = (
      <group.AppField name="productName">
        {(field) => (
          <field.TextField
            autoComplete="off"
            label="Product name"
            labelClassName={labelClassName}
            required={true}
          />
        )}
      </group.AppField>
    )
    const quantity = (
      <group.AppField name="expectedQuantityTonnes">
        {(field) => (
          <field.TextField
            autoComplete="off"
            className={isRow ? 'text-right tabular-nums' : undefined}
            inputMode="decimal"
            label="Expected quantity (t)"
            labelClassName={labelClassName}
            required={true}
          />
        )}
      </group.AppField>
    )

    if (!isRow) {
      return (
        <FieldGroup>
          {customer}
          {productName}
          {quantity}
          <group.AppField name="description">
            {(field) => <field.TextareaField label="Description" />}
          </group.AppField>
        </FieldGroup>
      )
    }

    return (
      <div className="flex flex-col gap-2">
        <div className={`grid gap-x-3 gap-y-3 md:items-start ${PRODUCT_LOT_ROW_COLUMNS}`}>
          {customer}
          {productName}
          {quantity}
          <div className="flex justify-end max-md:absolute max-md:top-1.5 max-md:right-0">
            {trailing}
          </div>
        </div>
        <group.AppField name="description">
          {(field) => (
            <OnDemand
              hasContent={field.state.value !== '' || field.state.meta.errors.length > 0}
              label="Add description"
            >
              {(openedOnDemand) => (
                // Opened by the user's click, the field takes the focus the button it replaces had.
                <field.TextareaField autoFocus={openedOnDemand} label="Description" rows={2} />
              )}
            </OnDemand>
          )}
        </group.AppField>
      </div>
    )
  },
})

/** An optional field kept out of the way until asked for, or until it already holds something. */
function OnDemand({
  children,
  hasContent,
  label,
}: {
  /** Receives whether the field was opened by the user rather than shown for its content. */
  children: (openedOnDemand: boolean) => ReactNode
  hasContent: boolean
  label: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  if (isOpen || hasContent) {
    return <div>{children(isOpen)}</div>
  }

  return (
    <Button
      className="self-start text-muted-foreground"
      onClick={() => setIsOpen(true)}
      size="sm"
      type="button"
      variant="ghost"
    >
      <PlusIcon aria-hidden="true" />
      {label}
    </Button>
  )
}
