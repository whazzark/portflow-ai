import { toast } from 'sonner'
import { FieldGroup } from '@/components/ui/field'
import {
  newPasswordSchema,
  newPasswordSubmitSchema,
} from '@/features/auth/helpers/new-password-schema'
import {
  isAlreadyRenewedError,
  usePasswordRenewal,
} from '@/features/auth/mutations/use-password-renewal'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { isUnauthorizedError, parseApiError } from '@/libraries/tuyau/api-error'

export function PasswordRenewalForm() {
  const passwordRenewal = usePasswordRenewal()

  const form = useAppForm({
    defaultValues: {
      password: '',
      passwordConfirmation: '',
    },
    validators: {
      onBlur: newPasswordSchema,
      onSubmit: newPasswordSubmitSchema,
    },
    onSubmit: async ({ formApi, value }) => {
      try {
        await passwordRenewal.mutateAsync({ body: value })
      } catch (error) {
        // The mutation is already moving the user off this screen — to sign-in for an expired
        // session, into the application for a requirement another submission already cleared. A
        // toast here would follow them onto a screen it makes no sense on.
        if (isUnauthorizedError(error) || isAlreadyRenewedError(error)) {
          return
        }

        const apiError = parseApiError(error)

        // `PasswordUnchangedException` is an `Exception` subclass, so the handler emits `meta` and
        // never `details[]` — `applyValidationError` has nothing to place. The mapping is explicit
        // here rather than the API shaping the response to look like a validation error it is not.
        if (apiError.code === 'E_PASSWORD_RENEWAL_UNCHANGED') {
          formApi.setErrorMap({
            onSubmit: { fields: { password: apiError.message }, form: '' },
          })

          return
        }

        if (!applyValidationError(formApi, error)) {
          toast.error('Unable to save your new password', { description: apiError.message })
        }
      }
    },
  })

  return (
    <form.AppForm>
      <form.Form className="flex flex-col gap-6">
        <FieldGroup>
          <form.AppField name="password">
            {(field) => (
              <field.TextField
                autoComplete="new-password"
                label="New password"
                placeholder="**********"
                required={true}
                type="password"
              />
            )}
          </form.AppField>

          <form.AppField name="passwordConfirmation">
            {(field) => (
              <field.TextField
                autoComplete="new-password"
                description="At least 12 characters."
                label="Confirm new password"
                placeholder="**********"
                required={true}
                type="password"
              />
            )}
          </form.AppField>
        </FieldGroup>

        <form.FormError />
        <form.SubmitButton className="h-10 w-full" pendingLabel="Saving…" size="lg">
          Save
        </form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}
