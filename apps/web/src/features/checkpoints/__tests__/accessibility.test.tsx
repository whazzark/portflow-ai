import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

const API_BASE_URL = 'http://localhost:3333'
const ADMIN = {
  id: 1,
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'admin@portflow.test',
  role: 'OPERATIONS_ADMIN',
  accessStatus: 'ACTIVE',
}
const dock = {
  id: 'dock-1',
  name: 'North Dock',
  latitude: 48.1,
  longitude: 2.1,
  status: 'AVAILABLE',
}

test('keeps checkpoint dialogs keyboard-safe and restores focus to the initiating control', async () => {
  const user = userEvent.setup()
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ADMIN })),
    http.get(`${API_BASE_URL}/api/v1/docks`, () => HttpResponse.json({ data: [dock] })),
    http.get(`${API_BASE_URL}/api/v1/docks/:id`, () => HttpResponse.json({ data: dock })),
  )

  renderApp('/checkpoints')
  const table = await screen.findByRole('table', { name: 'Available docks' })
  const inspect = within(table).getByRole('button', { name: 'Inspect dock North Dock' })

  await user.click(inspect)
  const details = await screen.findByRole('dialog', { name: 'North Dock' })
  expect(details).toHaveAttribute('aria-modal', 'true')
  expect(document.activeElement).toHaveAttribute('aria-label', 'Close dock details')

  await user.click(screen.getByRole('button', { name: 'Close dock details' }))
  await waitFor(() => expect(document.activeElement).toBe(inspect))
})
