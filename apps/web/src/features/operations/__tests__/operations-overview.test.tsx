import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

test('persists the selected operations section in the URL', async () => {
  const user = userEvent.setup()
  server.use(
    http.get('http://localhost:3333/auth/me', () =>
      HttpResponse.json({
        data: {
          id: 1,
          firstName: 'Claire',
          lastName: 'Martin',
          email: 'active.user@portflow.test',
        },
      }),
    ),
  )

  const { router } = renderApp('/?section=attention')

  expect(await screen.findByRole('tab', { name: 'Attention' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(router.state.location.search).toEqual({ section: 'attention' })

  await user.click(screen.getByRole('tab', { name: 'Rotations' }))
  expect(router.state.location.search).toEqual({ section: 'rotations' })
  expect(screen.getByRole('table', { name: 'Recent rotations' })).toBeInTheDocument()
})
