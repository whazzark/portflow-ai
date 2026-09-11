import { screen, within } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'

import { server } from '@/test/msw/server'
import { API_BASE_URL } from '../support/fixtures'

/** The reset succeeds, returning the target with its requirement and event recorded. */
export function mockResetSucceeds(user: Record<string, unknown>, administrator: { id: string }) {
  const calls: string[] = []

  server.use(
    http.post(`${API_BASE_URL}/api/v1/users/:id/password-reset`, ({ params }) => {
      calls.push(params.id as string)

      return HttpResponse.json({
        data: {
          ...user,
          passwordRenewalRequired: true,
          passwordResetAt: '2026-09-10T08:00:00.000Z',
          passwordResetBy: administrator,
        },
      })
    }),
  )

  return calls
}

export function mockResetRefused(code: string, message: string, status: number) {
  const calls: string[] = []

  server.use(
    http.post(`${API_BASE_URL}/api/v1/users/:id/password-reset`, ({ params }) => {
      calls.push(params.id as string)

      return HttpResponse.json({ error: { code, message } }, { status })
    }),
  )

  return calls
}

export async function openRecordFor(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  tableName = 'Active users',
) {
  const table = await screen.findByRole('table', { name: tableName })
  await user.click(within(table).getByRole('button', { name: `View user ${name}` }))

  return screen.getByRole('dialog')
}
