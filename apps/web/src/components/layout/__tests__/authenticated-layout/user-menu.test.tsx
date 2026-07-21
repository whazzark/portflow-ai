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

test('renders the protected frame with navigation for an authenticated user', async () => {
  server.use(http.get(`${API_BASE_URL}/auth/me`, () => HttpResponse.json({ data: ACTIVE_USER })))

  const { router } = renderApp('/')

  const nav = await screen.findByRole('navigation', { name: 'Primary' })
  const sidebar = screen.getByRole('complementary', { name: 'Application sidebar' })

  expect(screen.getByText('Claire Martin')).toBeInTheDocument()
  expect(screen.getByText('active.user@portflow.test')).toBeInTheDocument()
  expect(nav).toHaveAccessibleName('Primary')
  expect(sidebar).toContainElement(nav)
  const themeToggle = screen.getByRole('switch', { name: 'Switch to light theme' })
  const profileTrigger = screen.getByRole('button', {
    name: 'Open user menu for Claire Martin',
  })
  const accountSeparator = screen.getAllByRole('separator').at(-1)

  expect(themeToggle).toHaveAttribute('aria-checked', 'true')
  expect(accountSeparator).toBeDefined()
  expect(themeToggle.compareDocumentPosition(accountSeparator as HTMLElement)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  )
  expect((accountSeparator as HTMLElement).compareDocumentPosition(profileTrigger)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  )
  expect(screen.getByRole('heading', { name: 'Operations overview' })).toBeInTheDocument()
  expect(screen.getByText('Rotation progress')).toBeInTheDocument()
  expect(screen.getByRole('table', { name: 'Recent rotations' })).toBeInTheDocument()

  fireEvent.mouseDown(profileTrigger)
  const menu = await screen.findByRole('menu')

  expect(within(menu).getByText('CM')).toBeInTheDocument()
  expect(within(menu).getByText('Claire Martin')).toBeInTheDocument()
  expect(within(menu).getByText('active.user@portflow.test')).toBeInTheDocument()
  expect(within(menu).getByRole('menuitem', { name: /Profile/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  expect(within(menu).getByText('Coming soon')).toBeInTheDocument()
  expect(within(menu).getByRole('menuitem', { name: 'Log out' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/')
})
