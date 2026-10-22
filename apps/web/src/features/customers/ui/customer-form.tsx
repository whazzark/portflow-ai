import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { CUSTOMER_SINGULAR } from '@/features/customers/customer-lifecycle'
import type { CustomerDto } from '@/features/customers/types'
import { resourceFailureTitle, WRITE_PENDING_LABELS } from '@/helpers/resource-copy'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

const customerSchema = z.object({
  code: z.string().trim().min(1, 'Customer code is required.').max(255),
  companyName: z.string().trim().min(1, 'Company name is required.').max(255),
})

type CustomerFormValue = { code: string; companyName: string }

type CustomerFormProps = {
  customer?: CustomerDto
  /** The customers already listed, to name the one a refused code or company name belongs to. */
  customers: CustomerDto[]
  onCreate: (value: CustomerFormValue) => Promise<CustomerDto>
  onUpdate: (value: CustomerFormValue) => Promise<CustomerDto>
  onSuccess: (customer: CustomerDto) => void
  onCancel: () => void
}

/**
 * The field a uniqueness refusal belongs to, and the message naming who already holds the value.
 *
 * The API decides that a value is taken; the list only lends the holder's name, compared the way
 * the API normalises each value, so a typed ` acme-01 ` still finds `ACME-01`. A holder the list
 * does not show — another session created it since — is named generically.
 */
function conflictFieldError(
  errorCode: string,
  value: CustomerFormValue,
  customers: CustomerDto[],
  editedId: string | undefined,
) {
  const others = customers.filter((customer) => customer.id !== editedId)

  if (errorCode === 'E_CUSTOMER_CODE_CONFLICT') {
    const code = value.code.trim().toUpperCase()
    const holder = others.find((customer) => customer.code === code)

    return { code: `Already used by ${holder?.companyName ?? 'another customer'}.` }
  }

  if (errorCode === 'E_CUSTOMER_COMPANY_NAME_CONFLICT') {
    const companyName = value.companyName.trim().toLocaleLowerCase()
    const holder = others.find(
      (customer) => customer.companyName.toLocaleLowerCase() === companyName,
    )

    return { companyName: `Already used by ${holder?.code ?? 'another customer'}.` }
  }

  return null
}

export function CustomerForm({
  customer,
  customers,
  onCreate,
  onUpdate,
  onSuccess,
  onCancel,
}: CustomerFormProps) {
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
        const apiError = parseApiError(error)
        const fields = conflictFieldError(apiError.code, value, customers, customer?.id)

        if (fields) {
          formApi.setErrorMap({ onSubmit: { fields, form: '' } })
          return
        }

        if (!applyValidationError(formApi, error)) {
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
      <form.Form
        aria-label={customer ? 'Edit customer' : 'Create customer'}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          <FieldGroup>
            <form.AppField name="code">
              {(field) => (
                <field.TextField
                  autoComplete="off"
                  description={
                    customer
                      ? 'Stored in uppercase. Reports already generated keep the previous code.'
                      : undefined
                  }
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
          {!customer && (
            <p className="text-muted-foreground text-sm">
              The code identifies the customer in discharges and reports. It is stored in uppercase
              and can be changed later.
            </p>
          )}
          <form.FormError />
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-popover p-4 sm:flex-row">
          <form.SubmitButton pendingLabel={WRITE_PENDING_LABELS[customer ? 'update' : 'create']}>
            {customer ? 'Save changes' : 'Create customer'}
          </form.SubmitButton>
          <Button onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
        </div>
      </form.Form>
    </form.AppForm>
  )
}
