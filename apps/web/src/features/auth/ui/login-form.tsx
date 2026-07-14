import { type FormEvent, useState } from 'react'

import { useLogin } from '@/features/auth/mutations/use-login'
import { parseApiError } from '@/libraries/tuyau/api-error'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const login = useLogin()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    login.mutate({ body: { email, password } })
  }

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

      <button type="submit">Sign in</button>

      {login.isError && <p role="alert">{parseApiError(login.error).message}</p>}
    </form>
  )
}
