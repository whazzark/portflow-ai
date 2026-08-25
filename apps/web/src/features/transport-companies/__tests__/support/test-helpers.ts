import { HttpResponse, http } from 'msw'

import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import { ACTIVE_USER, API_BASE_URL, createdTransportCompany, TRANSPORT_COMPANIES } from './fixtures'

export function mockTransportCompanies(companies = TRANSPORT_COMPANIES, user = ACTIVE_USER) {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: user })),
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, () =>
      HttpResponse.json({ data: companies }),
    ),
  )
}

/**
 * Intercepts creation against a mutable collection so a test can assert that the new company
 * really reaches the directory through the invalidated consultation query, rather than only
 * asserting that the request was sent.
 */
export function mockTransportCompanyCreation(initial: TransportCompanyDto[] = TRANSPORT_COMPANIES) {
  const state = { companies: [...initial], attempts: 0 }

  server.use(
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, () =>
      HttpResponse.json({ data: state.companies }),
    ),
    http.post(`${API_BASE_URL}/api/v1/transport-companies`, async ({ request }) => {
      const body = (await request.json()) as {
        name: string
        contactPhone: string
        contactEmail: string
      }
      state.attempts += 1
      const created = createdTransportCompany(
        body.name.trim(),
        `created-${state.attempts}`,
        body.contactPhone.trim(),
        body.contactEmail.trim(),
      )
      state.companies = [...state.companies, created]

      return HttpResponse.json({ data: created }, { status: 201 })
    }),
  )

  return state
}

/**
 * Intercepts single archival against a mutable collection so a test can assert that the archived
 * company really moves lifecycle state through the invalidated consultation query, rather than
 * only asserting that the request was sent.
 */
export function mockTransportCompanyArchival(initial: TransportCompanyDto[] = TRANSPORT_COMPANIES) {
  const state = { companies: [...initial], attempts: 0, archivedByUserId: 'user-2' }

  server.use(
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, () =>
      HttpResponse.json({ data: state.companies }),
    ),
    http.post(
      `${API_BASE_URL}/api/v1/transport-companies/:id/archive`,
      async ({ params, request }) => {
        const body = (await request.json().catch(() => ({}))) as { comment?: string | null }
        state.attempts += 1
        const target = state.companies.find((company) => company.id === params.id)

        if (!target) {
          return HttpResponse.json(
            {
              error: {
                code: 'E_TRANSPORT_COMPANY_NOT_FOUND',
                message: 'Transport company not found',
              },
            },
            { status: 404 },
          )
        }

        const archivedAt = '2026-08-24T09:41:00.000Z'
        const archived: TransportCompanyDto = {
          ...target,
          status: 'ARCHIVED',
          archivedAt,
          archivedByUserId: state.archivedByUserId,
          archivedBy: { id: state.archivedByUserId, firstName: 'Claire', lastName: 'Martin' },
          archiveComment: body.comment?.trim() || null,
          updatedAt: archivedAt,
        }
        state.companies = state.companies.map((company) =>
          company.id === archived.id ? archived : company,
        )

        return HttpResponse.json({ data: archived })
      },
    ),
  )

  return state
}

/**
 * Intercepts single reactivation against a mutable collection so a test can assert that the
 * reactivated company really moves lifecycle state through the invalidated consultation query,
 * rather than only asserting that the request was sent.
 */
export function mockTransportCompanyReactivation(
  initial: TransportCompanyDto[] = TRANSPORT_COMPANIES,
) {
  const state = { companies: [...initial], attempts: 0, reactivatedByUserId: 'user-2' }

  server.use(
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, () =>
      HttpResponse.json({ data: state.companies }),
    ),
    http.post(
      `${API_BASE_URL}/api/v1/transport-companies/:id/reactivate`,
      async ({ params, request }) => {
        const body = (await request.json().catch(() => ({}))) as { comment?: string | null }
        state.attempts += 1
        const target = state.companies.find((company) => company.id === params.id)

        if (!target) {
          return HttpResponse.json(
            {
              error: {
                code: 'E_TRANSPORT_COMPANY_NOT_FOUND',
                message: 'Transport company not found',
              },
            },
            { status: 404 },
          )
        }

        const reactivatedAt = '2026-08-24T09:41:00.000Z'
        const reactivated: TransportCompanyDto = {
          ...target,
          status: 'AVAILABLE',
          reactivatedAt,
          reactivatedByUserId: state.reactivatedByUserId,
          reactivatedBy: {
            id: state.reactivatedByUserId,
            firstName: 'Claire',
            lastName: 'Martin',
          },
          reactivationComment: body.comment?.trim() || null,
          updatedAt: reactivatedAt,
        }
        state.companies = state.companies.map((company) =>
          company.id === reactivated.id ? reactivated : company,
        )

        return HttpResponse.json({ data: reactivated })
      },
    ),
  )

  return state
}

type BulkBlockerReason =
  | 'NOT_FOUND'
  | 'ALREADY_ARCHIVED'
  | 'ALREADY_AVAILABLE'
  | 'HAS_AVAILABLE_TRUCKS'
type BulkBlocker = { id: string; name?: string; reason: BulkBlockerReason }

/**
 * Intercepts bulk archival against a mutable collection, computing a real per-company partition
 * (already archived / blocked ids / eligible) so a test can assert the reported outcome rather
 * than only asserting that the request was sent.
 */
export function mockTransportCompanyBulkArchival({
  initial = TRANSPORT_COMPANIES,
  blockedIds = [],
}: {
  initial?: TransportCompanyDto[]
  blockedIds?: string[]
} = {}) {
  const state = { companies: [...initial], attempts: 0, archivedByUserId: 'user-2' }

  server.use(
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, () =>
      HttpResponse.json({ data: state.companies }),
    ),
    http.post(`${API_BASE_URL}/api/v1/transport-companies/archive`, async ({ request }) => {
      const body = (await request.json()) as { ids: string[]; comment?: string | null }
      state.attempts += 1

      const updatedCompanies: TransportCompanyDto[] = []
      const blockedCompanies: BulkBlocker[] = []
      const archivedAt = '2026-08-24T09:41:00.000Z'

      for (const id of body.ids) {
        const target = state.companies.find((company) => company.id === id)

        if (!target) {
          blockedCompanies.push({ id, reason: 'NOT_FOUND' })
          continue
        }
        if (target.status === 'ARCHIVED') {
          blockedCompanies.push({ id, name: target.name, reason: 'ALREADY_ARCHIVED' })
          continue
        }
        if (blockedIds.includes(id)) {
          blockedCompanies.push({ id, name: target.name, reason: 'HAS_AVAILABLE_TRUCKS' })
          continue
        }

        const archived: TransportCompanyDto = {
          ...target,
          status: 'ARCHIVED',
          archivedAt,
          archivedByUserId: state.archivedByUserId,
          archivedBy: { id: state.archivedByUserId, firstName: 'Claire', lastName: 'Martin' },
          archiveComment: body.comment?.trim() || null,
          updatedAt: archivedAt,
        }
        updatedCompanies.push(archived)
      }

      state.companies = state.companies.map(
        (company) => updatedCompanies.find((archived) => archived.id === company.id) ?? company,
      )

      return HttpResponse.json({ data: { updatedCompanies, blockedCompanies } })
    }),
  )

  return state
}

/**
 * Intercepts bulk reactivation against a mutable collection, computing a real per-company
 * partition (already available / not found / eligible) so a test can assert the reported outcome
 * rather than only asserting that the request was sent. Unlike archival, no artificial blocker
 * list is needed: ALREADY_AVAILABLE follows directly from each company's own status.
 */
export function mockTransportCompanyBulkReactivation({
  initial = TRANSPORT_COMPANIES,
}: {
  initial?: TransportCompanyDto[]
} = {}) {
  const state = { companies: [...initial], attempts: 0, reactivatedByUserId: 'user-2' }

  server.use(
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, () =>
      HttpResponse.json({ data: state.companies }),
    ),
    http.post(`${API_BASE_URL}/api/v1/transport-companies/reactivate`, async ({ request }) => {
      const body = (await request.json()) as { ids: string[]; comment?: string | null }
      state.attempts += 1

      const updatedCompanies: TransportCompanyDto[] = []
      const blockedCompanies: BulkBlocker[] = []
      const reactivatedAt = '2026-08-24T09:41:00.000Z'

      for (const id of body.ids) {
        const target = state.companies.find((company) => company.id === id)

        if (!target) {
          blockedCompanies.push({ id, reason: 'NOT_FOUND' })
          continue
        }
        if (target.status === 'AVAILABLE') {
          blockedCompanies.push({ id, name: target.name, reason: 'ALREADY_AVAILABLE' })
          continue
        }

        const reactivated: TransportCompanyDto = {
          ...target,
          status: 'AVAILABLE',
          reactivatedAt,
          reactivatedByUserId: state.reactivatedByUserId,
          reactivatedBy: {
            id: state.reactivatedByUserId,
            firstName: 'Claire',
            lastName: 'Martin',
          },
          reactivationComment: body.comment?.trim() || null,
          updatedAt: reactivatedAt,
        }
        updatedCompanies.push(reactivated)
      }

      state.companies = state.companies.map(
        (company) =>
          updatedCompanies.find((reactivated) => reactivated.id === company.id) ?? company,
      )

      return HttpResponse.json({ data: { updatedCompanies, blockedCompanies } })
    }),
  )

  return state
}

export function mockTransportCompanyBulkReactivationFailure(
  status: number,
  error: { code: string; message: string; details?: { field: string; message: string }[] },
) {
  const state = { attempts: 0 }

  server.use(
    http.post(`${API_BASE_URL}/api/v1/transport-companies/reactivate`, () => {
      state.attempts += 1

      return HttpResponse.json({ error }, { status })
    }),
  )

  return state
}

export function mockTransportCompanyArchivalFailure(
  status: number,
  error: { code: string; message: string; details?: { field: string; message: string }[] },
) {
  const state = { attempts: 0 }

  server.use(
    http.post(`${API_BASE_URL}/api/v1/transport-companies/:id/archive`, () => {
      state.attempts += 1

      return HttpResponse.json({ error }, { status })
    }),
  )

  return state
}

export function mockTransportCompanyReactivationFailure(
  status: number,
  error: { code: string; message: string; details?: { field: string; message: string }[] },
) {
  const state = { attempts: 0 }

  server.use(
    http.post(`${API_BASE_URL}/api/v1/transport-companies/:id/reactivate`, () => {
      state.attempts += 1

      return HttpResponse.json({ error }, { status })
    }),
  )

  return state
}

export function mockTransportCompanyBulkArchivalFailure(
  status: number,
  error: { code: string; message: string; details?: { field: string; message: string }[] },
) {
  const state = { attempts: 0 }

  server.use(
    http.post(`${API_BASE_URL}/api/v1/transport-companies/archive`, () => {
      state.attempts += 1

      return HttpResponse.json({ error }, { status })
    }),
  )

  return state
}

export function mockTransportCompanyCreationFailure(
  status: number,
  error: { code: string; message: string; details?: { field: string; message: string }[] },
) {
  const state = { attempts: 0 }

  server.use(
    http.post(`${API_BASE_URL}/api/v1/transport-companies`, () => {
      state.attempts += 1

      return HttpResponse.json({ error }, { status })
    }),
  )

  return state
}

export function renderTransportCompanies(initialPath = '/transport-resources') {
  return renderApp(initialPath)
}
