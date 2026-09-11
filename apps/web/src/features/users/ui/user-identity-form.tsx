import { toast } from 'sonner'
import { z } from 'zod'

import { FieldGroup } from '@/components/ui/field'
import { formatFullName } from '@/features/users/helpers/name'
import { USER_SINGULAR } from '@/features/users/helpers/user-labels'
import type { UserDto } from '@/features/users/types'
import {
  resourceFailureTitle,
  resourceSuccessMessage,
  WRITE_PENDING_LABELS,
} from '@/helpers/resource-copy'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

/** Mirrors the API bounds: `users.first_name`, `last_name`, and `email` are all `string` columns. */
const MAX_LENGTH = 255

const identitySchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(MAX_LENGTH),
  lastName: z.string().trim().min(1, 'Last name is required.').max(MAX_LENGTH),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .max(MAX_LENGTH)
    .email('Enter a valid email address.'),
})

export type UserIdentityValue = z.infer<typeof identitySchema>

/**
 * The refusals this form can answer on a field of its own. Everything else is a form-level message:
 * a correction refused because no activation link can be issued is about the user's state, not
 * about anything the administrator typed.
 */
const FIELD_REFUSALS: Record<string, keyof UserIdentityValue> = {
  E_USER_EMAIL_CONFLICT: 'email',
}

type UserIdentityFormProps = {
  user: UserDto
  onUpdate: (value: UserIdentityValue) => Promise<UserDto>
  onSuccess: (user: UserDto) => void
}

export function UserIdentityForm({ user, onUpdate, onSuccess }: UserIdentityFormProps) {
  const form = useAppForm({
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
    validators: {
      onBlur: identitySchema,
      onSubmit: identitySchema,
    },
    onSubmit: async ({ formApi, value }) => {
      try {
        const corrected = await onUpdate({
          firstName: value.firstName.trim(),
          lastName: value.lastName.trim(),
          email: value.email.trim(),
        })

        toast.success(resourceSuccessMessage('update', USER_SINGULAR, formatFullName(corrected)))
        onSuccess(corrected)
      } catch (error) {
        if (applyValidationError(formApi, error)) {
          return
        }

        const apiError = parseApiError(error)
        const field = FIELD_REFUSALS[apiError.code]

        // Reported in the form, never as a toast that leaves with the panel: the administrator has
        // to be able to read the reason next to what they typed, and try again from it.
        formApi.setErrorMap({
          onSubmit: {
            fields: field ? { [field]: apiError.message } : {},
            form: field ? '' : apiError.message,
          },
        })

        if (!field) {
          toast.error(resourceFailureTitle('update', USER_SINGULAR, formatFullName(user)), {
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
          <form.AppField name="firstName">
            {(field) => <field.TextField autoComplete="off" label="First name" required={true} />}
          </form.AppField>
          <form.AppField name="lastName">
            {(field) => <field.TextField autoComplete="off" label="Last name" required={true} />}
          </form.AppField>
          <form.AppField name="email">
            {(field) => (
              <field.TextField
                autoComplete="off"
                inputMode="email"
                label="Email"
                required={true}
                type="email"
              />
            )}
          </form.AppField>
        </FieldGroup>
        <form.FormError />
        <form.SubmitButton pendingLabel={WRITE_PENDING_LABELS.update}>
          Save changes
        </form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}
