import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

import { fill, findForm, ME_URL, mockSession, renderProfile, SESSION_USER, save } from './support'

test('opens from the user menu, pre-filled with the signed-in identity', async () => {
  mockSession()

  const { router } = renderApp('/')
  fireEvent.mouseDown(
    await screen.findByRole('button', { name: 'Open user menu for Claire Martin' }),
  )
  fireEvent.click(
    within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Profile' }),
  )

  const form = await findForm()
  expect(router.state.location.pathname).toBe('/profile')
  expect(
    within(screen.getByRole('banner')).getByRole('navigation', { name: 'breadcrumb' }),
  ).toHaveTextContent('Profile')
  expect(within(form).getByLabelText(/First name/)).toHaveValue('Claire')
  expect(within(form).getByLabelText(/Last name/)).toHaveValue('Martin')
  expect(within(form).getByLabelText(/Email/)).toHaveValue('claire.martin@portflow.test')
  expect(within(form).queryByLabelText(/Current password/)).not.toBeInTheDocument()
}, 15000)

test('updates the name and carries it to the session without a reload', async () => {
  const { submissions } = mockSession()

  renderProfile()
  await findForm()
  fill('Last name', 'Renard')
  save()

  await waitFor(() =>
    expect(submissions).toEqual([
      { firstName: 'Claire', lastName: 'Renard', email: 'claire.martin@portflow.test' },
    ]),
  )
  expect(await screen.findByText('Identity “Claire Renard” updated')).toBeInTheDocument()
  expect(
    await screen.findByRole('button', { name: 'Open user menu for Claire Renard' }),
  ).toBeInTheDocument()
}, 15000)

test('carries the update to the session from the response alone', async () => {
  mockSession()
  let meReads = 0
  // The session is readable once, for the page to open; every later read fails. Only the update's
  // own response can bring the new name to the user menu.
  server.use(
    http.get(ME_URL, () => {
      meReads += 1

      return meReads === 1
        ? HttpResponse.json({ data: SESSION_USER })
        : HttpResponse.json({ error: { code: 'E_INTERNAL', message: 'Down' } }, { status: 500 })
    }),
  )

  renderProfile()
  await findForm()
  fill('Last name', 'Renard')
  save()

  expect(
    await screen.findByRole('button', { name: 'Open user menu for Claire Renard' }),
  ).toBeInTheDocument()
}, 15000)

test('reopens on the current identity after a reload', async () => {
  mockSession({ firstName: 'Camille', lastName: 'Renard' })

  renderProfile()
  const form = await findForm()

  expect(within(form).getByLabelText(/First name/)).toHaveValue('Camille')
  expect(within(form).getByLabelText(/Last name/)).toHaveValue('Renard')
})

test.each(['ORGANIZATION_ADMIN', 'OPERATIONS_ADMIN', 'OPERATIONS_LEAD', 'OBSERVER'] as const)(
  'is offered to a signed-in %s',
  async (role) => {
    mockSession({ role })

    renderApp('/')
    fireEvent.mouseDown(
      await screen.findByRole('button', {
        name: `Open user menu for ${SESSION_USER.firstName} ${SESSION_USER.lastName}`,
      }),
    )
    const entry = within(await screen.findByRole('menu')).getByRole('menuitem', {
      name: 'Profile',
    })

    expect(entry).not.toHaveAttribute('aria-disabled', 'true')
  },
)
