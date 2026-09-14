import { toast } from 'sonner'
import { z } from 'zod'

import { FieldGroup } from '@/components/ui/field'
import { newPasswordSchema } from '@/features/auth/helpers/new-password-schema'
import { useOwnPasswordChange } from '@/features/profile/mutations/use-own-password-change'
import { isSessionHandover } from '@/features/profile/mutations/use-own-profile-update'
import { WRITE_PENDING_LABELS } from '@/helpers/resource-copy'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

type OwnPasswordValue = {
  currentPassword: string
  password: string
  passwordConfirmation: string
}

/**
 * The refusals this form answers on a field of its own. `resource-copy` is not used for its toasts:
 * a password is not a named record, so there is nothing to quote.
 */
const FIELD_REFUSALS: Record<string, keyof OwnPasswordValue> = {
  E_CURRENT_PASSWORD_INCORRECT: 'currentPassword',
  E_PASSWORD_UNCHANGED: 'password',
}

/** Each field on its own, which is all a blur should judge. */
const passwordFieldsSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  ...newPasswordSchema.shape,
})

/**
 * The match is checked on submission only — never on blur, for the reason `own-profile-form.tsx`
 * records: a rule joining two fields, judged as the first is left, leaves an error on a field the
 * user has not reached, and TanStack Form then drops their first click on the button.
 */
const passwordSubmitSchema = passwordFieldsSchema.refine(
  ({ password, passwordConfirmation }) => password === passwordConfirmation,
  { message: 'Passwords do not match.', path: ['passwordConfirmation'] },
)

export function OwnPasswordForm() {
  const ownPasswordChange = useOwnPasswordChange()

  const form = useAppForm({
    defaultValues: { currentPassword: '', password: '', passwordConfirmation: '' },
    validators: {
      onBlur: passwordFieldsSchema,
      onSubmit: passwordSubmitSchema,
    },
    onSubmit: async ({ formApi, value }) => {
      try {
        await ownPasswordChange.mutateAsync({ body: value })

        toast.success('Password changed')
        // Nothing of a replaced credential is kept on screen.
        formApi.reset()
      } catch (error) {
        // The mutation is already moving the user off this screen.
        if (isSessionHandover(error)) {
          return
        }

        formApi.setFieldValue('currentPassword', '')

        if (applyValidationError(formApi, error)) {
          return
        }

        const apiError = parseApiError(error)
        const field = FIELD_REFUSALS[apiError.code]

        formApi.setErrorMap({
          onSubmit: {
            fields: field ? { [field]: apiError.message } : {},
            form: field ? '' : apiError.message,
          },
        })

        if (!field) {
          toast.error('Unable to change your password', { description: apiError.message })
        }
      }
    },
  })

  return (
    <form.AppForm>
      <form.Form aria-label="Password" className="flex flex-col gap-6">
        <FieldGroup>
          <form.AppField name="currentPassword">
            {(field) => (
              <field.TextField
                autoComplete="current-password"
                label="Current password"
                required={true}
                type="password"
              />
            )}
          </form.AppField>
          <form.AppField name="password">
            {(field) => (
              <field.TextField
                autoComplete="new-password"
                description="At least 12 characters."
                label="New password"
                required={true}
                type="password"
              />
            )}
          </form.AppField>
          <form.AppField name="passwordConfirmation">
            {(field) => (
              <field.TextField
                autoComplete="new-password"
                label="Confirm new password"
                required={true}
                type="password"
              />
            )}
          </form.AppField>
        </FieldGroup>
        <form.FormError />
        <form.SubmitButton className="self-start" pendingLabel={WRITE_PENDING_LABELS.update}>
          Change password
        </form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}
