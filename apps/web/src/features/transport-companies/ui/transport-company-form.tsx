import { z } from 'zod'

import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { applyRefusal, type RefusalPlacement } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'

export const transportCompanyFormSchema = z.object({
  name: z.string().trim().min(1, 'Company name is required.').max(255),
  contactPhone: z.string().trim().min(1, 'Contact phone is required.').max(32),
  contactEmail: z.string().trim().min(1, 'Contact email is required.').email().max(255),
})

export type TransportCompanyFormValue = z.infer<typeof transportCompanyFormSchema>

const TRANSPORT_COMPANY_REFUSALS: Record<string, RefusalPlacement> = {
  E_TRANSPORT_COMPANY_NAME_CONFLICT: { field: 'name' },
  E_TRANSPORT_COMPANY_CONTACT_PHONE_INVALID: { field: 'contactPhone' },
  E_TRANSPORT_COMPANY_CONTACT_EMAIL_INVALID: { field: 'contactEmail' },
}

/** A transport company's creation or correction form; its refusals stay beside what was typed. */
export function useTransportCompanyForm({
  company,
  onSubmit,
  onSuccess,
}: {
  company?: TransportCompanyDto
  onSubmit: (value: TransportCompanyFormValue) => Promise<TransportCompanyDto>
  onSuccess: (company: TransportCompanyDto) => void
}) {
  return useAppForm({
    defaultValues: {
      name: company?.name ?? '',
      contactPhone: company?.contactPhone ?? '',
      contactEmail: company?.contactEmail ?? '',
    },
    validators: {
      onBlur: transportCompanyFormSchema,
      onSubmit: transportCompanyFormSchema,
    },
    onSubmit: async ({ formApi, value }) => {
      try {
        onSuccess(
          await onSubmit({
            name: value.name.trim(),
            contactPhone: value.contactPhone.trim(),
            contactEmail: value.contactEmail.trim(),
          }),
        )
      } catch (error) {
        applyRefusal(formApi, error, TRANSPORT_COMPANY_REFUSALS)
      }
    },
  })
}
