import { toast } from 'sonner'
import { z } from 'zod'
import { FieldGroup } from '@/components/ui/field'
import { useLogin } from '@/features/auth/mutations/use-login'
import { applyValidationError } from '@/libraries/forms/api-error'
import { useAppForm } from '@/libraries/forms/form'
import { parseApiError } from '@/libraries/tuyau/api-error'

const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
  rememberMe: z.boolean(),
})

export function LoginForm() {
  const login = useLogin()

  const form = useAppForm({
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    validators: {
      onBlur: loginSchema,
      onSubmit: loginSchema,
    },
    onSubmit: async ({ formApi, value }) => {
      try {
        await login.mutateAsync({ body: value })
      } catch (error) {
        if (!applyValidationError(formApi, error)) {
          const apiError = parseApiError(error)

          toast.error('Unable to log in', { description: apiError.message })
        }
      }
    },
  })

  return (
    <form.AppForm>
      <form.Form className="flex flex-col gap-6">
        <FieldGroup>
          <form.AppField name="email">
            {(field) => (
              <field.TextField
                autoComplete="email"
                label="Email address"
                placeholder="name@company.com"
                required={true}
                type="email"
              />
            )}
          </form.AppField>

          <form.AppField name="password">
            {(field) => (
              <field.TextField
                autoComplete="current-password"
                label="Password"
                placeholder="**********"
                required={true}
                type="password"
              />
            )}
          </form.AppField>
        </FieldGroup>

        <form.AppField name="rememberMe">
          {(field) => <field.CheckboxField label="Remember me for 30 days" />}
        </form.AppField>

        <form.FormError />
        <form.SubmitButton className="h-10 w-full" pendingLabel="Logging in…" size="lg">
          Log in
        </form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}
