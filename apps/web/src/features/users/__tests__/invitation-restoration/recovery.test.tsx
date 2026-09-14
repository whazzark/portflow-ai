import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import type { UserDto } from '@/features/users/types'
import { server } from '@/test/msw/server'
import { API_BASE_URL, ORGANIZATION_ADMIN, USERS } from '../support/fixtures'
import { renderUsers } from '../support/test-helpers'
import {
  CANCELLED_USER,
  mockRestorationRefused,
  mockRestorationUnreachable,
  mockUsersWithRestoration,
  NEW_LINK,
  openCancelledRowMenu,
  startRestorationFromRecord,
} from './helpers'

const COMMENT = { name: 'Comment (optional)' }

test.each([
  ['an unreachable server', () => mockRestorationUnreachable()],
  ['a server failure', () => mockRestorationRefused('E_INTERNAL', 'Something went wrong', 500)],
])(
  'keeps the dialog and the comment after %s, and a retry hands out one link',
  async (_label, fail) => {
    const user = userEvent.setup()
    const { requests } = mockUsersWithRestoration()
    fail()

    renderUsers('/users?status=cancelled')
    const dialog = await startRestorationFromRecord(user)
    await user.type(within(dialog).getByRole('textbox', COMMENT), 'Start date confirmed.')
    await user.click(within(dialog).getByRole('button', { name: 'Restore invitation' }))

    expect(await screen.findByText("Unable to restore Élodie Fabre's invitation")).toBeVisible()
    expect(screen.getByRole('alertdialog')).toBe(dialog)
    expect(within(dialog).getByRole('textbox', COMMENT)).toHaveValue('Start date confirmed.')
    const confirm = within(dialog).getByRole('button', { name: 'Restore invitation' })
    await waitFor(() => expect(confirm).toBeEnabled())
    expect(screen.queryByTestId('activation-link')).not.toBeInTheDocument()

    // The problem is resolved: the stateful handler answers again.
    const { requests: retried } = mockUsersWithRestoration()
    await user.click(confirm)

    expect(await screen.findByTestId('activation-link')).toHaveTextContent(NEW_LINK)
    expect(screen.getAllByTestId('activation-link')).toHaveLength(1)
    expect(requests).toHaveLength(0)
    expect(retried).toEqual([{ id: 'cancelled-1', body: { comment: 'Start date confirmed.' } }])
  },
)

test('drops a row that moved on from the refreshed view, and still says why', async () => {
  // Someone else restored this invitation after the view was listed: the API refuses as pending, and
  // the next read of the collection serves the user pending too.
  const alreadyRestored = USERS.map((entry) =>
    entry.id === 'cancelled-1' ? ({ ...entry, accessStatus: 'PENDING' } as UserDto) : entry,
  )
  let movedOn = false
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () =>
      HttpResponse.json({ data: ORGANIZATION_ADMIN }),
    ),
    http.get(`${API_BASE_URL}/api/v1/users`, () =>
      HttpResponse.json({ data: movedOn ? alreadyRestored : USERS }),
    ),
    http.post(`${API_BASE_URL}/api/v1/users/:id/restore-invitation`, () => {
      movedOn = true

      return HttpResponse.json(
        {
          error: {
            code: 'E_USER_NOT_CANCELLED',
            message: 'Only a cancelled invitation can be restored',
            meta: { accessStatus: 'PENDING' },
          },
        },
        { status: 409 },
      )
    }),
  )
  const user = userEvent.setup()

  renderUsers('/users?status=cancelled')
  await openCancelledRowMenu(CANCELLED_USER)
  await user.click(screen.getByRole('menuitem', { name: 'Restore invitation' }))
  const confirmation = await screen.findByRole('alertdialog')
  await user.click(within(confirmation).getByRole('button', { name: 'Restore invitation' }))

  expect(
    await screen.findByText(
      "Élodie Fabre's invitation is already pending, so there is nothing to restore. Renew their activation link if they need a new one.",
    ),
  ).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: `Actions for ${CANCELLED_USER}` }),
    ).not.toBeInTheDocument(),
  )
  expect(screen.queryByTestId('activation-link')).not.toBeInTheDocument()
})
