import { toast } from 'sonner'
import { z } from 'zod'
import { FieldGroup } from '@/components/ui/field'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

const transportCompanySchema = z.object({
  name: z.string().trim().min(1, 'Company name is required.').max(255),
})

type TransportCompanyFormProps = {
  company: TransportCompanyDto
  onUpdate: (value: { name: string }) => Promise<TransportCompanyDto>
  onSuccess: (company: TransportCompanyDto) => void
}

export function TransportCompanyForm({ company, onUpdate, onSuccess }: TransportCompanyFormProps) {
  const form = useAppForm({
    defaultValues: {
      name: company.name,
    },
    validators: {
      onBlur: transportCompanySchema,
      onSubmit: transportCompanySchema,
    },
    onSubmit: async ({ formApi, value }) => {
      try {
        const result = await onUpdate(value)

        onSuccess(result)
      } catch (error) {
        if (!applyValidationError(formApi, error)) {
          const apiError = parseApiError(error)

          toast.error('Unable to update transport company', {
            description: apiError.message,
          })
        }
      }
    },
  })

  return (
    <form.AppForm>
      <form.Form className="flex flex-col gap-6">
        <FieldGroup>
          <form.AppField name="name">
            {(field) => (
              <field.TextField
                autoComplete="organization"
                label="Company name"
                placeholder="Atlantic Transport"
                required={true}
              />
            )}
          </form.AppField>
        </FieldGroup>
        <form.FormError />
        <form.SubmitButton pendingLabel="Saving…">Save changes</form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}
