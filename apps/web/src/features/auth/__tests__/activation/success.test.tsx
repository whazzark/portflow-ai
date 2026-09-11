import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse } from 'msw'
import { expect, test, vi } from 'vitest'
import {
  ACTIVATED_USER,
  ACTIVATION_TOKEN,
  findActivationHeading,
  mockAcceptance,
  mockPreview,
  mockSession,
  PREVIEW,
  renderActivation,
  submitActivation,
  VALID_PASSWORD,
} from './helpers'

test('shows whose access the link activates and the password form, with nothing else', async () => {
  mockSession()
  mockPreview()

  const { router } = renderActivation()

  expect(await findActivationHeading()).toBeInTheDocument()
  expect(screen.getByText(/Claire Martin/)).toBeInTheDocument()
  expect(screen.getByDisplayValue(PREVIEW.email)).toHaveAttribute('readonly')
  expect(screen.getByLabelText(/^Password/)).toHaveAttribute('autocomplete', 'new-password')
  expect(screen.getByLabelText(/^Confirm password/)).toHaveAttribute('autocomplete', 'new-password')
  expect(screen.queryByLabelText(/remember/i)).not.toBeInTheDocument()
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  expect(screen.queryByText(ACTIVATION_TOKEN)).not.toBeInTheDocument()

  // The production shell renders these through `<HeadContent />`, which the test root omits.
  expect(router.state.matches.flatMap((match) => match.meta ?? [])).toContainEqual({
    name: 'referrer',
    content: 'no-referrer',
  })
})

test('sends the token in the body and lands in the application, leaving no way back to the link', async () => {
  const user = userEvent.setup()
  const session = mockSession()
  mockPreview()
  mockAcceptance(async (request) => {
    expect(new URL(request.url).pathname).toBe('/api/v1/auth/invitation-acceptance')
    expect(await request.json()).toEqual({
      token: ACTIVATION_TOKEN,
      password: VALID_PASSWORD,
      passwordConfirmation: VALID_PASSWORD,
    })
    session.user = ACTIVATED_USER

    return HttpResponse.json({ data: ACTIVATED_USER })
  })

  const { router } = renderActivation()
  await findActivationHeading()
  await submitActivation(user, VALID_PASSWORD)

  expect(await screen.findByText(ACTIVATED_USER.email)).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/')
  expect(router.state.location.search).toEqual({ section: 'rotations' })

  // Replaced, not pushed: the activation URL is gone from history, so Back cannot return to it.
  router.history.back()
  await waitFor(() => expect(router.state.location.pathname).not.toMatch(/^\/activate\//))
})

test('keeps the pending form, not a log-out notice, while the application is still loading', async () => {
  const user = userEvent.setup()
  const session = mockSession()
  mockPreview()
  mockAcceptance(() => {
    session.user = ACTIVATED_USER

    return HttpResponse.json({ data: ACTIVATED_USER })
  })

  const { router } = renderActivation()
  await findActivationHeading()

  // Held the way a first visit holds it while the application's code loads: the session is open
  // by then, and the activation screen still mounted reads it.
  let releaseNavigation = () => {}
  const navigationHeld = new Promise<void>((resolve) => {
    releaseNavigation = resolve
  })
  const navigate = router.navigate
  const navigateSpy = vi.spyOn(router, 'navigate').mockImplementation(async (options) => {
    await navigationHeld

    return navigate(options)
  })

  await submitActivation(user, VALID_PASSWORD)
  await waitFor(() => expect(navigateSpy).toHaveBeenCalled())
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)))

  expect(screen.queryByText(/Log out to continue/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Activating…' })).toBeDisabled()

  releaseNavigation()
  expect(await screen.findByText(ACTIVATED_USER.email)).toBeInTheDocument()
})
