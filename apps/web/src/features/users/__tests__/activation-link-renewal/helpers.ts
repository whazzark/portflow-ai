import { fireEvent, screen, within } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'

import { server } from '@/test/msw/server'
import { API_BASE_URL } from '../support/fixtures'

const RENEWAL_PATH = `${API_BASE_URL}/api/v1/users/:id/activation-link-renewal`

export const RENEWED_AT = '2026-09-11T09:30:00.000Z'
export const NEW_EXPIRY = '2026-09-18T09:30:00.000Z'
export const NEW_LINK = 'http://localhost:3000/activate/renewed-secret-for-the-test'

/** The renewal succeeds, returning the user with the renewal recorded and the link, once. */
export function mockRenewalSucceeds(user: Record<string, unknown>, administrator: { id: string }) {
  const calls: string[] = []

  server.use(
    http.post(RENEWAL_PATH, ({ params }) => {
      calls.push(params.id as string)

      return HttpResponse.json({
        data: {
          user: {
            ...user,
            activationLinkRenewedAt: RENEWED_AT,
            activationLinkRenewedBy: administrator,
            activationLinkExpiresAt: NEW_EXPIRY,
          },
          activationLink: { url: NEW_LINK, expiresAt: NEW_EXPIRY },
        },
      })
    }),
  )

  return calls
}

/** The renewal never answers until the test lets it, so an in-flight state can be observed. */
export function mockRenewalPending(user: Record<string, unknown>, administrator: { id: string }) {
  const calls: string[] = []
  let release: () => void = () => undefined
  const released = new Promise<void>((resolve) => {
    release = resolve
  })

  server.use(
    http.post(RENEWAL_PATH, async ({ params }) => {
      calls.push(params.id as string)
      await released

      return HttpResponse.json({
        data: {
          user: {
            ...user,
            activationLinkRenewedAt: RENEWED_AT,
            activationLinkRenewedBy: administrator,
          },
          activationLink: { url: NEW_LINK, expiresAt: NEW_EXPIRY },
        },
      })
    }),
  )

  return { calls, release: () => release() }
}

export function mockRenewalRefused(code: string, message: string, status: number, meta?: unknown) {
  const calls: string[] = []

  server.use(
    http.post(RENEWAL_PATH, ({ params }) => {
      calls.push(params.id as string)

      return HttpResponse.json({ error: { code, message, meta } }, { status })
    }),
  )

  return calls
}

export function mockRenewalUnreachable() {
  server.use(http.post(RENEWAL_PATH, () => HttpResponse.error()))
}

export async function openPendingRecordFor(user: ReturnType<typeof userEvent.setup>, name: string) {
  const table = await screen.findByRole('table', { name: 'Pending users' })
  await user.click(within(table).getByRole('button', { name: `View user ${name}` }))

  return screen.getByRole('dialog')
}

/**
 * The menu is portaled out of the table, so its items are queried from `screen` rather than through
 * the row — which the directory re-renders underneath them.
 */
export async function openPendingRowMenu(name: string) {
  await screen.findByRole('table', { name: 'Pending users' })
  fireEvent.click(await screen.findByRole('button', { name: `Actions for ${name}` }))
  await screen.findByRole('menu')
}
