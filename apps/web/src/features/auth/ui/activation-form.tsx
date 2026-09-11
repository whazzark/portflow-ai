import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  newPasswordSchema,
  newPasswordSubmitSchema,
} from '@/features/auth/helpers/new-password-schema'
import {
  isActivationLinkUnusableError,
  isSessionNotOpenedError,
  isSessionOpenError,
  useInvitationAcceptance,
} from '@/features/auth/mutations/use-invitation-acceptance'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'

type ActivationFormProps = {
  token: string
  /** Shown, never submitted: the person recognizes the access, and a password manager files the
   *  new credential under the right account. */
  email: string
  /** The link died between opening and submitting: the screen, not a field, answers that. */
  onUnusable: () => void
  /** Activated, but logged in nowhere: the screen, not the form, says what to do next. */
  onActivatedWithoutSession: () => void
}

export function ActivationForm({
  token,
  email,
  onUnusable,
  onActivatedWithoutSession,
}: ActivationFormProps) {
  const invitationAcceptance = useInvitationAcceptance()

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
        await invitationAcceptance.mutateAsync({ body: { token, ...value } })
      } catch (error) {
        if (isActivationLinkUnusableError(error)) {
          onUnusable()

          return
        }

        // The mutation is already re-reading the session, which swaps this form for the signed-in
        // state; an error here would describe a screen that is about to disappear.
        if (isSessionOpenError(error)) {
          return
        }

        if (isSessionNotOpenedError(error)) {
          onActivatedWithoutSession()

          return
        }

        // Placed on its field, with what was typed left in place for the correction.
        if (applyValidationError(formApi, error)) {
          return
        }

        // Anything else — the network, the server — changed nothing: the link is still usable, so
        // the same submission can simply be made again.
        formApi.setErrorMap({
          onSubmit: { fields: {}, form: "We couldn't activate your access. Try again." },
        })
      }
    },
  })

  return (
    <form.AppForm>
      <form.Form className="flex flex-col gap-6">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="activation-email">Email</FieldLabel>
            <Input autoComplete="username" id="activation-email" readOnly={true} value={email} />
          </Field>

          <form.AppField name="password">
            {(field) => (
              <field.TextField
                autoComplete="new-password"
                description="At least 12 characters."
                label="Password"
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
                label="Confirm password"
                placeholder="**********"
                required={true}
                type="password"
              />
            )}
          </form.AppField>
        </FieldGroup>

        <form.FormError />
        <form.SubmitButton className="h-10 w-full" pendingLabel="Activating…" size="lg">
          Activate
        </form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}
