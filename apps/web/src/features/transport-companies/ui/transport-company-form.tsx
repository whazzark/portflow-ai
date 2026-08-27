import { toast } from 'sonner'
import { z } from 'zod'
import { FieldGroup } from '@/components/ui/field'
import { TRANSPORT_COMPANY_SINGULAR } from '@/features/transport-companies/transport-company-lifecycle'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { resourceFailureTitle } from '@/helpers/resource-copy'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

const transportCompanySchema = z.object({
  name: z.string().trim().min(1, 'Company name is required.').max(255),
  contactPhone: z.string().trim().min(1, 'Contact phone is required.').max(32),
  contactEmail: z.string().trim().min(1, 'Contact email is required.').email().max(255),
})

export type TransportCompanyFormValue = {
  name: string
  contactPhone: string
  contactEmail: string
}

type TransportCompanyFormProps = {
  company?: TransportCompanyDto
  onCreate: (value: TransportCompanyFormValue) => Promise<TransportCompanyDto>
  onUpdate: (value: TransportCompanyFormValue) => Promise<TransportCompanyDto>
  onSuccess: (company: TransportCompanyDto) => void
}

export function TransportCompanyForm({
  company,
  onCreate,
  onUpdate,
  onSuccess,
}: TransportCompanyFormProps) {
  const form = useAppForm({
    defaultValues: {
      name: company?.name ?? '',
      contactPhone: company?.contactPhone ?? '',
      contactEmail: company?.contactEmail ?? '',
    },
    validators: {
      onBlur: transportCompanySchema,
      onSubmit: transportCompanySchema,
    },
    onSubmit: async ({ formApi, value }) => {
      const submitted = {
        ...value,
        name: value.name.trim(),
        contactPhone: value.contactPhone.trim(),
        contactEmail: value.contactEmail.trim(),
      }

      try {
        const result = company ? await onUpdate(submitted) : await onCreate(submitted)

        onSuccess(result)
      } catch (error) {
        if (!applyValidationError(formApi, error)) {
          const apiError = parseApiError(error)

          toast.error(
            company
              ? resourceFailureTitle('update', TRANSPORT_COMPANY_SINGULAR, company.name)
              : resourceFailureTitle('create', TRANSPORT_COMPANY_SINGULAR, submitted.name),
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
          <form.AppField name="contactPhone">
            {(field) => (
              <field.TextField
                autoComplete="tel"
                label="Contact phone"
                placeholder="+33 2 40 12 34 56"
                required={true}
                type="tel"
              />
            )}
          </form.AppField>
          <form.AppField name="contactEmail">
            {(field) => (
              <field.TextField
                autoComplete="email"
                label="Contact email"
                placeholder="dispatch@example.com"
                required={true}
                type="email"
              />
            )}
          </form.AppField>
        </FieldGroup>
        <form.FormError />
        <form.SubmitButton pendingLabel="Saving…">
          {company ? 'Save changes' : 'Create transport company'}
        </form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}
