import { type FormEvent, useState } from 'react'

import { useLogin } from '@/features/auth/mutations/use-login'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { parseApiError } from '@/libraries/tuyau/api-error'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const login = useLogin()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    login.mutate({ body: { email, password, rememberMe } })
  }

  const apiError = login.isError ? parseApiError(login.error) : null

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      <Label htmlFor="remember-me">
        <Checkbox
          id="remember-me"
          checked={rememberMe}
          onCheckedChange={(checked) => setRememberMe(checked === true)}
        />
        Remember me for 30 days
      </Label>

      <button type="submit">Sign in</button>

      {apiError && (
        <div role="alert">
          <p>{apiError.message}</p>
          {apiError.details?.map((detail) => (
            <p key={detail.field}>{detail.message}</p>
          ))}
        </div>
      )}
    </form>
  )
}
