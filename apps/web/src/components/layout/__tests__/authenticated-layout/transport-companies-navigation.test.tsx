import { screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

const API_BASE_URL = 'http://localhost:3333'
const ROLES = ['ORGANIZATION_ADMIN', 'OPERATIONS_ADMIN', 'OPERATIONS_LEAD', 'OBSERVER'] as const

test.each(ROLES)('shows transport-resource navigation to an active %s', async (role) => {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () =>
      HttpResponse.json({
        data: {
          id: `${role}-1`,
          firstName: 'Active',
          lastName: 'User',
          email: `${role.toLowerCase()}@portflow.test`,
          role,
          accessStatus: 'ACTIVE',
        },
      }),
    ),
  )

  renderApp('/')
  const nav = await screen.findByRole('navigation', { name: 'Primary' })

  expect(within(nav).getByRole('link', { name: /Transport resources/ })).toHaveAttribute(
    'href',
    '/transport-resources',
  )
})
