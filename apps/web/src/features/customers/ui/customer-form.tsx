import { toast } from 'sonner'
import { z } from 'zod'
import { FieldGroup } from '@/components/ui/field'
import { CUSTOMER_SINGULAR } from '@/features/customers/customer-lifecycle'
import type { CustomerDto } from '@/features/customers/types'
import { resourceFailureTitle } from '@/helpers/resource-copy'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

const customerSchema = z.object({
  code: z.string().trim().min(1, 'Customer code is required.').max(255),
  companyName: z.string().trim().min(1, 'Company name is required.').max(255),
})

type CustomerFormProps = {
  customer?: CustomerDto
  onCreate: (value: { code: string; companyName: string }) => Promise<CustomerDto>
  onUpdate: (value: { code: string; companyName: string }) => Promise<CustomerDto>
  onSuccess: (customer: CustomerDto) => void
}

export function CustomerForm({ customer, onCreate, onUpdate, onSuccess }: CustomerFormProps) {
  const form = useAppForm({
    defaultValues: {
      code: customer?.code ?? '',
      companyName: customer?.companyName ?? '',
    },
    validators: {
      onBlur: customerSchema,
      onSubmit: customerSchema,
    },
    onSubmit: async ({ formApi, value }) => {
      try {
        const result = customer ? await onUpdate(value) : await onCreate(value)

        onSuccess(result)
      } catch (error) {
        if (!applyValidationError(formApi, error)) {
          const apiError = parseApiError(error)

          toast.error(
            customer
              ? resourceFailureTitle('update', CUSTOMER_SINGULAR, customer.companyName)
              : resourceFailureTitle('create', CUSTOMER_SINGULAR, value.companyName.trim()),
            { description: apiError.message },
          )
        }
      }
    },
  })

  return (
    <form.AppForm>
      <form.Form className="flex flex-col gap-6">
        <FieldGroup>
          <form.AppField name="code">
            {(field) => (
              <field.TextField
                autoComplete="off"
                label="Customer code"
                placeholder="ACME-01"
                required={true}
              />
            )}
          </form.AppField>
          <form.AppField name="companyName">
            {(field) => (
              <field.TextField
                autoComplete="organization"
                label="Company name"
                placeholder="Acme Logistics"
                required={true}
              />
            )}
          </form.AppField>
        </FieldGroup>
        <form.FormError />
        <form.SubmitButton pendingLabel="Saving…">
          {customer ? 'Save changes' : 'Create customer'}
        </form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}
