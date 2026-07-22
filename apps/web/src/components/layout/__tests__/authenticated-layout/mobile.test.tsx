import { fireEvent, screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

const API_BASE_URL = 'http://localhost:3333'
const ACTIVE_USER = {
  id: 1,
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'active.user@portflow.test',
}

test('opens the application sidebar from the mobile menu trigger', async () => {
  const previousInnerWidth = window.innerWidth
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ACTIVE_USER })),
  )

  try {
    renderApp('/')

    const trigger = await screen.findByRole('button', { name: 'Open sidebar' })
    fireEvent.click(trigger)

    const sidebar = await screen.findByRole('dialog', { name: 'Sidebar' })
    expect(within(sidebar).getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
  } finally {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: previousInnerWidth })
  }
})
