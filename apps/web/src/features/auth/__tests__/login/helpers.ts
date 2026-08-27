import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { renderApp } from '@/test/render-app'

export const API_BASE_URL = 'http://localhost:3333'
export const ACTIVE_USER = {
  id: 1,
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'active.user@portflow.test',
  passwordRenewalRequired: false,
}

export async function renderLogin(path = '/') {
  const result = renderApp(path)
  await screen.findByRole('heading', { name: 'Keep every handoff on track' })
  return result
}

export async function submitLogin(
  user: ReturnType<typeof userEvent.setup>,
  password = 'Password!234',
) {
  await user.type(screen.getByLabelText(/^Email address/), ACTIVE_USER.email)
  await user.type(screen.getByLabelText(/^Password/), password)
  await user.click(screen.getByRole('button', { name: 'Log in' }))
}
