import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { renderApp } from '@/test/render-app'
import { findRenewalHeading, mockSession, RENEWED_USER } from './helpers'

test('returns a confined session to the renewal step from an application route', async () => {
  mockSession('confined')

  const { router } = renderApp('/customers')

  expect(await findRenewalHeading()).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/password-renewal')
})

test('returns a confined session to the renewal step from the sign-in screen', async () => {
  mockSession('confined')

  const { router } = renderApp('/login')

  expect(await findRenewalHeading()).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/password-renewal')
})

test('sends a session owing nothing from the renewal step to the application', async () => {
  mockSession('renewed')

  const { router } = renderApp('/password-renewal')

  expect(await screen.findByText(RENEWED_USER.email)).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/')
})

test('sends an unauthenticated visitor from the renewal step to the sign-in screen', async () => {
  mockSession('signed-out')

  const { router } = renderApp('/password-renewal')

  expect(
    await screen.findByRole('heading', { name: 'Keep every handoff on track' }),
  ).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/login')
})
