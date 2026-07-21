import { screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { renderApp } from '@/test/render-app'

test('redirects unauthenticated access to the protected frame to the login screen', async () => {
  const { router } = renderApp('/')

  expect(
    await screen.findByRole('heading', { name: 'Keep every handoff on track' }),
  ).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/login')
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
})
