import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import {
  mockIdentityCorrection,
  mockIdentityCorrectionRefused,
  renderUsers,
} from '../support/test-helpers'

const openRecordFor = async (name: string) => {
  const table = await screen.findByRole('table', { name: 'Active users' }, { timeout: 5000 })
  fireEvent.click(within(table).getByRole('button', { name: `View user ${name}` }))

  return screen.findByRole('dialog')
}

const openEditorFor = async (name: string) => {
  const record = await openRecordFor(name)
  fireEvent.click(within(record).getByRole('button', { name: 'Edit' }))

  expect(await screen.findByRole('heading', { name: 'Edit identity' })).toBeInTheDocument()

  return screen.getByRole('dialog')
}

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: label }), { target: { value } })

test('corrects an identity and carries it back to the collection', async () => {
  const { corrections, collection } = mockIdentityCorrection()

  renderUsers()
  await openEditorFor('Amélie Bernard')
  fill('First name', 'Amelie')
  fill('Email', 'amelie.bernard@portflow.example')
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() =>
    expect(corrections).toEqual([
      {
        id: 'active-1',
        body: {
          firstName: 'Amelie',
          lastName: 'Bernard',
          email: 'amelie.bernard@portflow.example',
        },
      },
    ]),
  )
  // The record is a view over the collection, so the corrected user reaching it is what proves the
  // collection itself was refreshed — the table behind the open sheet is `aria-hidden` and cannot
  // be queried while the record stands.
  const record = await screen.findByRole('dialog')
  expect(
    await within(record).findByRole('heading', { name: /Amelie Bernard/ }, { timeout: 5000 }),
  ).toBeInTheDocument()
  expect(within(record).getByText('amelie.bernard@portflow.example')).toBeInTheDocument()
  expect(collection[0]).toMatchObject({
    firstName: 'Amelie',
    email: 'amelie.bernard@portflow.example',
  })
}, 15000)

test('returns to the record once the correction is applied', async () => {
  mockIdentityCorrection()

  const { router } = renderUsers()
  await openEditorFor('Amélie Bernard')
  fill('First name', 'Amelie')
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(router.state.location.search).toMatchObject({ mode: 'view' }))
  expect(screen.queryByRole('heading', { name: 'Edit identity' })).not.toBeInTheDocument()
})

test('holds the open editor in the URL', async () => {
  mockIdentityCorrection()

  const { router } = renderUsers()
  await openEditorFor('Amélie Bernard')

  expect(router.state.location.search).toMatchObject({ userId: 'active-1', mode: 'edit' })
})

test('opens the editor directly from a shared address', async () => {
  mockIdentityCorrection()

  renderUsers('/users?userId=active-1&mode=edit')

  expect(await screen.findByRole('heading', { name: 'Edit identity' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'First name' })).toHaveValue('Amélie')
  expect(screen.getByRole('textbox', { name: 'Last name' })).toHaveValue('Bernard')
  expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('amelie.bernard@portflow.test')
})

test('leaves the editor through Back to details without correcting anything', async () => {
  const { corrections } = mockIdentityCorrection()

  renderUsers()
  const editor = await openEditorFor('Amélie Bernard')
  fill('First name', 'Amelie')
  fireEvent.click(within(editor).getByRole('button', { name: 'Back to details' }))

  expect(await screen.findByRole('heading', { name: /Amélie Bernard/ })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit identity' })).not.toBeInTheDocument()
  expect(corrections).toHaveLength(0)
})

test('drops a mode that no open record backs', async () => {
  mockIdentityCorrection()

  const { router } = renderUsers('/users?mode=edit')

  await screen.findByRole('table', { name: 'Active users' })
  expect(router.state.location.search.mode).toBeUndefined()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('reports a refused address on the email field and keeps what was typed', async () => {
  mockIdentityCorrectionRefused(
    { code: 'E_USER_EMAIL_CONFLICT', message: 'Email address is already used by another user' },
    409,
  )

  renderUsers()
  await openEditorFor('Amélie Bernard')
  fill('Email', 'bruno.costa@portflow.test')
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(
    await screen.findByText('Email address is already used by another user'),
  ).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('bruno.costa@portflow.test')
  expect(screen.getByRole('heading', { name: 'Edit identity' })).toBeInTheDocument()
})

test('reports a field-level validation refusal on its own field', async () => {
  mockIdentityCorrectionRefused(
    {
      code: 'E_VALIDATION_ERROR',
      message: 'Validation failure',
      details: [{ field: 'firstName', message: 'The first name field must not be blank' }],
    },
    422,
  )

  renderUsers()
  await openEditorFor('Amélie Bernard')
  fill('First name', 'Amelie')
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('The first name field must not be blank')).toBeInTheDocument()
})

test('keeps a pending user reachable while their address cannot be moved', async () => {
  mockIdentityCorrectionRefused(
    {
      code: 'E_USER_ACTIVATION_LINK_UNAVAILABLE',
      message:
        'The email address of a user who has not activated their access cannot be changed until an activation link can be issued to the new address',
    },
    409,
  )

  renderUsers('/users?status=pending&userId=pending-1&mode=edit')

  expect(await screen.findByRole('heading', { name: 'Edit identity' })).toBeInTheDocument()
  fill('Email', 'chloe.durand@portflow.example')
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(
    await screen.findByText(/cannot be changed until an activation link can be issued/),
  ).toBeInTheDocument()
})
