import { fireEvent, screen, waitFor, within } from '@testing-library/react'
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
  role: 'ORGANIZATION_ADMIN',
  accessStatus: 'ACTIVE',
}

test('renders the protected frame with navigation for an authenticated user', async () => {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ACTIVE_USER })),
  )

  const { router } = renderApp('/')

  const nav = await screen.findByRole('navigation', { name: 'Primary' })
  const sidebar = screen.getByRole('complementary', { name: 'Application sidebar' })
  const header = screen.getByRole('banner')

  // The sidebar names the role; the email waits in the menu.
  expect(screen.getByText('Claire Martin')).toBeInTheDocument()
  expect(within(sidebar).getByText('Organization admin')).toBeInTheDocument()
  expect(within(sidebar).queryByText('active.user@portflow.test')).not.toBeInTheDocument()
  expect(nav).toHaveAccessibleName('Primary')
  expect(sidebar).toContainElement(nav)
  expect(within(header).getByRole('navigation', { name: 'breadcrumb' })).toHaveTextContent(
    'Overview',
  )
  expect(within(header).getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument()
  expect(within(nav).getByText('Monitoring')).toBeInTheDocument()
  expect(within(nav).getByText('Operations')).toBeInTheDocument()
  expect(within(nav).getByText('Site references')).toBeInTheDocument()
  expect(within(nav).getByText('Administration')).toBeInTheDocument()
  expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/')
  expect(within(nav).getByRole('link', { name: /Discharges/ })).toHaveAttribute(
    'href',
    '/discharges',
  )
  expect(within(nav).getByRole('button', { name: /Rotation validation/ })).toBeDisabled()
  expect(within(nav).getByRole('link', { name: /Customers/ })).toHaveAttribute('href', '/customers')
  expect(within(nav).getByRole('link', { name: /Transport resources/ })).toHaveAttribute(
    'href',
    '/transport-resources',
  )
  expect(within(nav).getByRole('link', { name: /Checkpoints/ })).toHaveAttribute(
    'href',
    '/checkpoints',
  )
  expect(within(nav).getByRole('link', { name: /Warehouses/ })).toHaveAttribute(
    'href',
    '/warehouses',
  )
  expect(within(nav).getByRole('link', { name: /Users/ })).toHaveAttribute('href', '/users')
  // Only Rotation validation remains unbuilt: Discharges gained its workbench in GH-61.
  expect(within(nav).getAllByText('Soon')).toHaveLength(1)
  const profileTrigger = screen.getByRole('button', {
    name: 'Open user menu for Claire Martin',
  })

  // The appearance switch lives in the user menu now, not in the sidebar.
  expect(within(sidebar).queryByText('Appearance')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Operations overview' })).toBeInTheDocument()
  expect(screen.getByText('Rotation progress')).toBeInTheDocument()
  expect(screen.getByRole('table', { name: 'Recent rotations' })).toBeInTheDocument()

  fireEvent.click(within(header).getByRole('button', { name: 'Collapse sidebar' }))
  expect(document.querySelector('[data-slot="sidebar"][data-state]')).toHaveAttribute(
    'data-state',
    'collapsed',
  )
  expect(within(header).getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()

  const comingSoonItem = within(nav).getByRole('button', { name: /Rotation validation/ })
  fireEvent.pointerEnter(comingSoonItem.parentElement as HTMLElement)
  expect(comingSoonItem.parentElement).toHaveAttribute('data-base-ui-tooltip-trigger', '')

  fireEvent.mouseDown(profileTrigger)
  const menu = await screen.findByRole('menu')

  expect(within(menu).getByText('CM')).toBeInTheDocument()
  expect(within(menu).getByText('Claire Martin')).toBeInTheDocument()
  expect(within(menu).getByText('active.user@portflow.test')).toBeInTheDocument()
  const profileEntry = within(menu).getByRole('menuitem', { name: 'Profile' })
  expect(profileEntry).not.toHaveAttribute('aria-disabled', 'true')
  expect(within(menu).queryByText('Soon')).not.toBeInTheDocument()
  const appearance = within(menu).getByRole('group', { name: 'Appearance' })
  expect(within(appearance).getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  expect(within(menu).getByRole('menuitem', { name: 'Log out' })).toBeInTheDocument()

  // Picking a theme applies it and leaves the menu open.
  fireEvent.click(within(appearance).getByRole('menuitemradio', { name: 'Light' }))
  expect(document.documentElement).not.toHaveClass('dark')
  expect(within(appearance).getByRole('menuitemradio', { name: 'Light' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  expect(screen.getByRole('menu')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/')

  fireEvent.click(profileEntry)

  await waitFor(() => expect(router.state.location.pathname).toBe('/profile'))
})

test('hides user administration from non-administrative roles', async () => {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () =>
      HttpResponse.json({
        data: {
          ...ACTIVE_USER,
          role: 'OPERATIONS_LEAD',
        },
      }),
    ),
  )

  renderApp('/')

  const nav = await screen.findByRole('navigation', { name: 'Primary' })

  expect(within(nav).queryByText('Administration')).not.toBeInTheDocument()
  expect(within(nav).queryByRole('link', { name: /Users/ })).not.toBeInTheDocument()
})
