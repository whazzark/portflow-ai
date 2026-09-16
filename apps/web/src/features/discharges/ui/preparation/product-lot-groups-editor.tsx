import { PlusIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  addProductLotsFormDefaults,
  emptyLotGroup,
  type ProductLotGroupFormValues,
} from '@/features/discharges/discharge-preparation-schema'
import type { PreparationOptions } from '@/features/discharges/ui/preparation/preparation-options'
import { ProductLotGroupFields } from '@/features/discharges/ui/preparation/product-lot-group-fields'
import { RemoveRowButton } from '@/features/discharges/ui/preparation/repeated-rows'
import { withFieldGroup } from '@/libraries/forms/form'

type CustomerOption = { id: string; name: string }

/**
 * The lots a preparation enters, customer by customer: each block picks its customer once and lists
 * the products the vessel carries for it. A customer chosen in one block is not offered in another,
 * so a customer's lots always stay together.
 */
export const ProductLotGroupsEditor = withFieldGroup({
  defaultValues: addProductLotsFormDefaults() as { lotGroups: ProductLotGroupFormValues[] },
  props: {
    customers: { options: [], loading: false } as PreparationOptions<CustomerOption>,
  },
  render: function ProductLotGroupsEditorRender({ group, customers }) {
    return (
      <group.AppField mode="array" name="lotGroups">
        {(lotGroups) => (
          <div className="flex flex-col gap-4">
            {lotGroups.state.value.map((_, groupIndex) => {
              const blockLabel = `Customer ${groupIndex + 1}`

              return (
                <group.Subscribe
                  // biome-ignore lint/suspicious/noArrayIndexKey: array fields are addressed by index
                  key={groupIndex}
                  selector={(state) =>
                    state.values.lotGroups
                      .filter((_, index) => index !== groupIndex)
                      .map((other) => other.customerId)
                      .join(',')
                  }
                >
                  {(takenKey) => (
                    <ProductLotGroupFields
                      blockLabel={blockLabel}
                      customerOptionFilter={(customerId) =>
                        !takenKey.split(',').includes(customerId)
                      }
                      customers={customers}
                      fields={`lotGroups[${groupIndex}]`}
                      form={group}
                      headerAction={
                        <RemoveRowButton
                          canRemove={lotGroups.state.value.length > 1}
                          label={blockLabel}
                          onRemove={() => lotGroups.removeValue(groupIndex)}
                        />
                      }
                      rowRemoval={(_, rowCount) => ({ canRemove: rowCount > 1 })}
                    />
                  )}
                </group.Subscribe>
              )
            })}
            <Button
              className="self-start"
              onClick={() => lotGroups.pushValue(emptyLotGroup())}
              type="button"
              variant="outline"
            >
              <PlusIcon aria-hidden="true" />
              Add customer
            </Button>
          </div>
        )}
      </group.AppField>
    )
  },
})
