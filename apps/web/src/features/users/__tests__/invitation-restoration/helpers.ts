import { fireEvent, screen, within } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'

import type { UserDto } from '@/features/users/types'
import { server } from '@/test/msw/server'
import { API_BASE_URL, ORGANIZATION_ADMIN, RESTORED_AT, USERS } from '../support/fixtures'

const RESTORE_PATH = `${API_BASE_URL}/api/v1/users/:id/restore-invitation`

export const NEW_EXPIRY = '2099-09-19T08:15:00.000Z'
export const NEW_LINK = 'http://localhost:3000/activate/restored-secret-for-the-test'

export const CANCELLED_USER = 'Élodie Fabre'

type Viewer = { id: string; firstName: string; lastName: string }

/** The user as the API answers a restoration: pending again, the event recorded, a new link live. */
function restored(target: UserDto, viewer: Viewer, comment: string | null): UserDto {
  return {
    ...target,
    accessStatus: 'PENDING',
    invitationRestoredAt: RESTORED_AT,
    invitationRestoredBy: { id: viewer.id, firstName: viewer.firstName, lastName: viewer.lastName },
    invitationRestorationComment: comment,
    activationLinkExpiresAt: NEW_EXPIRY,
  } as UserDto
}

/**
 * The collection and the restoration together, so that a restoration changes what the next read of
 * the collection returns — the refresh the workbench relies on to move the user between views.
 */
export function mockUsersWithRestoration(viewer: Viewer = ORGANIZATION_ADMIN, users = USERS) {
  let collection = users
  const requests: Array<{ id: string; body: unknown }> = []

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: viewer })),
    http.get(`${API_BASE_URL}/api/v1/users`, () => HttpResponse.json({ data: collection })),
    http.post(RESTORE_PATH, async ({ params, request }) => {
      const body = (await request.json().catch(() => null)) as { comment?: string | null } | null
      requests.push({ id: String(params.id), body })

      const target = collection.find((user) => user.id === params.id)

      if (!target) {
        return HttpResponse.json(
          { error: { code: 'E_USER_NOT_FOUND', message: 'User not found' } },
          { status: 404 },
        )
      }

      const user = restored(target, viewer, body?.comment?.trim() || null)
      collection = collection.map((entry) => (entry.id === user.id ? user : entry))

      return HttpResponse.json({
        data: { user, activationLink: { url: NEW_LINK, expiresAt: NEW_EXPIRY } },
      })
    }),
  )

  return { requests }
}

/** The restoration never answers until the test lets it, so an in-flight state can be observed. */
export function mockRestorationPending(viewer: Viewer = ORGANIZATION_ADMIN) {
  const calls: string[] = []
  let release: () => void = () => undefined
  const released = new Promise<void>((resolve) => {
    release = resolve
  })

  server.use(
    http.post(RESTORE_PATH, async ({ params }) => {
      calls.push(params.id as string)
      await released

      const target = USERS.find((user) => user.id === params.id) as UserDto

      return HttpResponse.json({
        data: {
          user: restored(target, viewer, null),
          activationLink: { url: NEW_LINK, expiresAt: NEW_EXPIRY },
        },
      })
    }),
  )

  return { calls, release: () => release() }
}

export function mockRestorationRefused(
  code: string,
  message: string,
  status: number,
  meta?: unknown,
  details?: unknown,
) {
  const calls: Array<{ id: string; body: unknown }> = []

  server.use(
    http.post(RESTORE_PATH, async ({ params, request }) => {
      calls.push({ id: params.id as string, body: await request.json().catch(() => null) })

      return HttpResponse.json({ error: { code, message, meta, details } }, { status })
    }),
  )

  return calls
}

export function mockRestorationUnreachable() {
  server.use(http.post(RESTORE_PATH, () => HttpResponse.error()))
}

export async function openCancelledRecordFor(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  const table = await screen.findByRole('table', { name: 'Cancelled users' })
  await user.click(within(table).getByRole('button', { name: `View user ${name}` }))

  return screen.getByRole('dialog')
}

/**
 * The menu is portaled out of the table, so its items are queried from `screen` rather than through
 * the row — which the directory re-renders underneath them.
 */
export async function openCancelledRowMenu(name: string) {
  await screen.findByRole('table', { name: 'Cancelled users' })
  fireEvent.click(await screen.findByRole('button', { name: `Actions for ${name}` }))
  await screen.findByRole('menu')
}

/** Starts the restoration from the open record and returns its confirmation. */
export async function startRestorationFromRecord(
  user: ReturnType<typeof userEvent.setup>,
  name = CANCELLED_USER,
) {
  const record = await openCancelledRecordFor(user, name)
  await user.click(within(record).getByRole('button', { name: 'Restore invitation' }))

  return screen.findByRole('alertdialog')
}
