import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { server } from '@/test/msw/server'
import { API_BASE_URL } from '../support/fixtures'
import { renderUsers } from '../support/test-helpers'
import {
  CANCELLED_USER,
  mockUsersWithRestoration,
  NEW_LINK,
  openCancelledRecordFor,
  startRestorationFromRecord,
} from './helpers'

const restoreFromRecord = async (user: ReturnType<typeof userEvent.setup>) => {
  const confirmation = await startRestorationFromRecord(user)
  await user.click(within(confirmation).getByRole('button', { name: 'Restore invitation' }))

  return screen.findByTestId('activation-link')
}

test('hands out the new link once, in the outcome that names the restoration', async () => {
  const user = userEvent.setup()
  mockUsersWithRestoration()

  renderUsers('/users?status=cancelled')
  const link = await restoreFromRecord(user)

  expect(link).toHaveTextContent(NEW_LINK)
  const outcome = screen.getByRole('alertdialog')
  expect(
    within(outcome).getByText(/Élodie Fabre's invitation is pending again/),
  ).toBeInTheDocument()
  expect(
    within(outcome).getByText(/Any link they were given before still does not work/),
  ).toBeInTheDocument()
  expect(within(outcome).getByText('This link is shown once')).toBeInTheDocument()
  expect(within(outcome).getByRole('button', { name: 'Copy activation link' })).toBeInTheDocument()

  // A secret with no second read is not dismissed by accident.
  await user.keyboard('{Escape}')
  expect(screen.getByTestId('activation-link')).toBeInTheDocument()
})

test('keeps the outcome open while the restored user leaves the view and their record closes', async () => {
  const user = userEvent.setup()
  mockUsersWithRestoration()

  renderUsers('/users?status=cancelled')
  await restoreFromRecord(user)

  // The refresh moves the user to Pending, so the record opened from Cancelled closes under the
  // outcome — and the link, held by the page, stays on screen.
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByTestId('activation-link')).toHaveTextContent(NEW_LINK)
})

test('stays on the cancelled view after Done, and follows both counts', async () => {
  const user = userEvent.setup()
  mockUsersWithRestoration()

  renderUsers('/users?status=cancelled')
  expect(await screen.findByRole('tab', { name: /Cancelled \(1\)/ })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /Pending \(1\)/ })).toBeInTheDocument()

  await restoreFromRecord(user)
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Done' }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())

  expect(screen.queryByText(NEW_LINK)).not.toBeInTheDocument()
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: /Cancelled \(0\)/ })).toBeInTheDocument(),
  )
  expect(screen.getByRole('tab', { name: /Pending \(2\)/ })).toBeInTheDocument()
  // No navigation: the view the administrator was working through is still the selected one.
  expect(screen.getByRole('tab', { name: /Cancelled \(0\)/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test('records the restoration after the cancellation in the reopened record', async () => {
  const user = userEvent.setup()
  mockUsersWithRestoration()

  renderUsers('/users?status=cancelled')
  await restoreFromRecord(user)
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Done' }))

  await waitFor(() =>
    expect(screen.getByRole('tab', { name: /Pending \(2\)/ })).toBeInTheDocument(),
  )
  await user.click(screen.getByRole('tab', { name: /Pending \(2\)/ }))
  const table = await screen.findByRole('table', { name: 'Pending users' })
  await user.click(within(table).getByRole('button', { name: `View user ${CANCELLED_USER}` }))

  const reopened = screen.getByRole('dialog')
  const history = within(reopened).getByRole('list', { name: 'Access history' })
  const labels = within(history)
    .getAllByRole('listitem')
    .map((item) => item.querySelector('span')?.textContent)
  expect(labels).toEqual(['Invited', 'Cancelled', 'Invitation restored'])
  const entry = within(history).getByText('Invitation restored').closest('li') as HTMLElement
  expect(within(entry).getByText('by Claire Martin')).toBeInTheDocument()
  // The restored record offers no second restoration.
  expect(
    within(reopened).queryByRole('button', { name: 'Restore invitation' }),
  ).not.toBeInTheDocument()
})

test('makes the invitation refusal’s “Restore it instead” lead to an action on that user', async () => {
  const user = userEvent.setup()
  mockUsersWithRestoration()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/users`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_USER_EMAIL_CONFLICT',
            message: 'Email is already in use',
            meta: { accessStatus: 'CANCELLED' },
          },
        },
        { status: 409 },
      ),
    ),
  )

  renderUsers('/users?status=cancelled')
  await user.click(await screen.findByRole('button', { name: 'Invite user' }))
  const panel = await screen.findByRole('dialog')
  await user.type(within(panel).getByLabelText(/First name/), 'Élodie')
  await user.type(within(panel).getByLabelText(/Last name/), 'Fabre')
  await user.type(within(panel).getByLabelText(/Email/), 'elodie.fabre@portflow.test')
  await user.click(within(panel).getByRole('button', { name: 'Invite user' }))
  expect(await within(panel).findByText(/Restore it instead/i)).toBeInTheDocument()

  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  const record = await openCancelledRecordFor(user, CANCELLED_USER)

  expect(within(record).getByRole('button', { name: 'Restore invitation' })).toBeInTheDocument()
})
