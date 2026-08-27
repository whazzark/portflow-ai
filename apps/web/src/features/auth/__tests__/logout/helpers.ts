import { fireEvent, screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { server } from '@/test/msw/server'

export const API_BASE_URL = 'http://localhost:3333'
export const ACTIVE_USER = {
  id: 1,
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'active.user@portflow.test',
  passwordRenewalRequired: false,
}

export function mockAuthenticatedSession() {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ACTIVE_USER })),
  )
}

export async function openLogoutConfirmation() {
  fireEvent.mouseDown(screen.getByRole('button', { name: 'Open user menu for Claire Martin' }))
  const menu = await screen.findByRole('menu')
  fireEvent.click(within(menu).getByRole('menuitem', { name: 'Log out' }))
  return screen.findByRole('alertdialog')
}
