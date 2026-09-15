import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, HttpResponse, http } from 'msw'
import { afterAll, beforeAll, expect, vi } from 'vitest'

import type { SessionUser } from '@/features/auth/context/session-context'
import type { DischargeDetailDto, DischargeDto } from '@/features/discharges/types'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import {
  ACTIVE_OBSERVER,
  ACTIVE_OPERATIONS_LEAD,
  API_BASE_URL,
  AVAILABLE_CUSTOMERS,
  AVAILABLE_DOCKS,
  DISCHARGE_DETAILS,
  DISCHARGES,
  ELIGIBLE_RESPONSIBLES,
} from './fixtures'

type MockDischargesOptions = {
  user?: SessionUser
  discharges?: DischargeDto[]
  onRequest?: () => void
  /** Fail the collection this many times before answering, to exercise retry. */
  failTimes?: number
}

export function mockDischarges({
  user = ACTIVE_OBSERVER,
  discharges = DISCHARGES,
  onRequest,
  failTimes = 0,
}: MockDischargesOptions = {}) {
  let remainingFailures = failTimes

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: user })),
    http.get(`${API_BASE_URL}/api/v1/discharges`, () => {
      onRequest?.()

      if (remainingFailures > 0) {
        remainingFailures -= 1

        return new HttpResponse(null, { status: 500 })
      }

      return HttpResponse.json({ data: discharges })
    }),
  )
}

type MockDischargeDetailOptions = {
  user?: SessionUser
  details?: DischargeDetailDto[]
  /** Answer every detail request with the discharge not-found error. */
  notFound?: boolean
  /** Fail the detail this many times before answering, to exercise retry. */
  failTimes?: number
  /** Hold every answer back this long, to observe the pending state. */
  delayMs?: number
  onRequest?: (id: string) => void
}

export function mockDischargeDetail({
  user = ACTIVE_OBSERVER,
  details = DISCHARGE_DETAILS,
  notFound = false,
  failTimes = 0,
  delayMs = 0,
  onRequest,
}: MockDischargeDetailOptions = {}) {
  let remainingFailures = failTimes

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: user })),
    http.get(`${API_BASE_URL}/api/v1/discharges/:id`, async ({ params }) => {
      const id = String(params.id)
      onRequest?.(id)

      if (delayMs > 0) {
        await delay(delayMs)
      }

      if (remainingFailures > 0) {
        remainingFailures -= 1

        return new HttpResponse(null, { status: 500 })
      }

      const detail = details.find((candidate) => candidate.id === id)

      if (notFound || !detail) {
        return HttpResponse.json(
          { error: { code: 'E_DISCHARGE_NOT_FOUND', message: 'Discharge not found' } },
          { status: 404 },
        )
      }

      return HttpResponse.json({ data: detail })
    }),
  )
}

export function renderDischarges(path = '/discharges') {
  return renderApp(path)
}

export function renderDischargeDetail(id: string, search = '') {
  return renderApp(`/discharges/${id}${search}`)
}

export function dischargeTab(name: RegExp | string) {
  return screen.getByRole('tab', { name })
}

export async function findDischargeRows() {
  const table = await screen.findByRole('table', { name: 'Discharges' })

  return within(table).getAllByRole('row').slice(1)
}

type MockPreparationOptionsOptions = {
  user?: SessionUser
  docks?: typeof AVAILABLE_DOCKS
  customers?: typeof AVAILABLE_CUSTOMERS
  responsibles?: typeof ELIGIBLE_RESPONSIBLES
  /** Fail the available customers this many times before answering, to exercise retry. */
  failTimes?: number
  delayMs?: number
  onResponsiblesRequest?: () => void
}

/** The session and the three collections the creation page offers its choices from. */
export function mockPreparationOptions({
  user = ACTIVE_OPERATIONS_LEAD,
  docks = AVAILABLE_DOCKS,
  customers = AVAILABLE_CUSTOMERS,
  responsibles = ELIGIBLE_RESPONSIBLES,
  failTimes = 0,
  delayMs = 0,
  onResponsiblesRequest,
}: MockPreparationOptionsOptions = {}) {
  let remainingFailures = failTimes

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: user })),
    http.get(`${API_BASE_URL}/api/v1/docks/available`, async () => {
      if (delayMs > 0) {
        await delay(delayMs)
      }

      return HttpResponse.json({ data: docks })
    }),
    http.get(`${API_BASE_URL}/api/v1/customers/available`, () => {
      if (remainingFailures > 0) {
        remainingFailures -= 1

        return new HttpResponse(null, { status: 500 })
      }

      return HttpResponse.json({ data: customers })
    }),
    http.get(`${API_BASE_URL}/api/v1/users/eligible-shift-responsibles`, () => {
      onResponsiblesRequest?.()

      return HttpResponse.json({ data: responsibles })
    }),
  )
}

type CreateDischargeBody = {
  id: string
  vesselName: string
  vesselImo: string | null
  vesselComment: string | null
  dockId: string
  expectedStartAt: string
  productLots: Array<{
    customerId: string
    productName: string
    expectedQuantityTonnes: string
    description: string | null
  }>
  shifts: Array<{ plannedStartAt: string; plannedEndAt: string; responsibleUserId: string }>
}

/** The detail the API would answer a creation with, built from what was sent. */
export function detailFromCreation(body: CreateDischargeBody): DischargeDetailDto {
  const dock =
    AVAILABLE_DOCKS.find((candidate) => candidate.id === body.dockId) ?? AVAILABLE_DOCKS[0]

  return {
    id: body.id,
    status: 'PLANNED',
    vesselName: body.vesselName,
    vesselImo: body.vesselImo,
    vesselComment: body.vesselComment,
    expectedStartAt: body.expectedStartAt,
    expectedTonnage: '0.000',
    dock: { id: dock.id, name: dock.name, status: 'AVAILABLE' },
    productLots: body.productLots.map((lot, index) => {
      const customer = AVAILABLE_CUSTOMERS.find((candidate) => candidate.id === lot.customerId)

      return {
        id: `created-lot-${index + 1}`,
        productName: lot.productName,
        description: lot.description,
        expectedQuantityTonnes: Number(lot.expectedQuantityTonnes).toFixed(3),
        customer: {
          id: lot.customerId,
          name: customer?.companyName ?? lot.customerId,
          status: 'AVAILABLE',
        },
        doorAssignments: [],
      }
    }),
    shifts: [...body.shifts]
      .sort((left, right) => Date.parse(left.plannedStartAt) - Date.parse(right.plannedStartAt))
      .map((shift, index) => {
        const responsible = ELIGIBLE_RESPONSIBLES.find(
          (candidate) => candidate.id === shift.responsibleUserId,
        ) ?? { id: shift.responsibleUserId, firstName: 'Unknown', lastName: 'User' }

        return {
          id: `created-shift-${index + 1}`,
          status: 'PLANNED',
          plannedStartAt: shift.plannedStartAt,
          plannedEndAt: shift.plannedEndAt,
          responsible,
          trucks: [],
          warehouseDoors: [],
          weighingAreas: [],
        }
      }),
    truckPool: [],
  }
}

type MockCreateDischargeOptions = {
  onRequest?: (body: CreateDischargeBody) => void
  /** Decide the answer to each submission; by default the discharge is created. */
  respond?: (
    body: CreateDischargeBody,
  ) => { status: number; body: unknown } | 'network-error' | undefined
  delayMs?: number
}

/**
 * Answers creations and then serves each created discharge's detail, as the API would once the
 * page navigates to it.
 */
export function mockCreateDischarge({
  onRequest,
  respond,
  delayMs = 0,
}: MockCreateDischargeOptions = {}) {
  const created = new Map<string, DischargeDetailDto>()

  server.use(
    http.post(`${API_BASE_URL}/api/v1/discharges`, async ({ request }) => {
      const body = (await request.json()) as CreateDischargeBody
      onRequest?.(body)

      if (delayMs > 0) {
        await delay(delayMs)
      }

      const answer = respond?.(body) ?? {
        status: 201,
        body: { data: detailFromCreation(body) },
      }

      if (answer === 'network-error') {
        return HttpResponse.error()
      }

      const data = (answer.body as { data?: DischargeDetailDto }).data
      if (answer.status < 300 && data) {
        created.set(data.id, data)
      }

      return HttpResponse.json(answer.body as object, { status: answer.status })
    }),
    http.get(`${API_BASE_URL}/api/v1/discharges/:id`, ({ params }) => {
      const detail = created.get(String(params.id))

      if (!detail) {
        return HttpResponse.json(
          { error: { code: 'E_DISCHARGE_NOT_FOUND', message: 'Discharge not found' } },
          { status: 404 },
        )
      }

      return HttpResponse.json({ data: detail })
    }),
  )

  return { created }
}

export function renderCreateDischarge(search = '') {
  return renderApp(`/discharges/new${search}`)
}

/**
 * Picks an option of a searchable select by its field label: types the option's name, as a user
 * narrowing a long list would, then chooses it among the matches.
 */
export async function chooseOption(container: HTMLElement, label: string, option: string) {
  const combobox = within(container).getByRole('combobox', { name: label })

  // The field cannot be used until its choices have loaded, as it cannot for a user.
  await waitFor(() => expect(combobox).not.toHaveAttribute('aria-busy', 'true'))
  await userEvent.clear(combobox)
  await userEvent.type(combobox, option)
  const target = await screen.findByRole('option', { name: option })
  // The list commits the highlighted item: hovering highlights it as a pointer would.
  fireEvent.pointerMove(target)
  fireEvent.mouseMove(target)
  fireEvent.click(target)
  await waitFor(() => expect(combobox).toHaveValue(option))
  await waitFor(() => expect(combobox).not.toHaveAttribute('aria-expanded', 'true'))
}

export function fillText(container: HTMLElement, label: string, value: string) {
  fireEvent.change(within(container).getByLabelText(new RegExp(`^${label}`)), {
    target: { value },
  })
}

const RESPONSIBLE_NAME = `${ELIGIBLE_RESPONSIBLES[0].firstName} ${ELIGIBLE_RESPONSIBLES[0].lastName}`

export async function openCreationFromList() {
  // biome-ignore lint/security/noSecrets: route search string, not a secret
  const app = renderApp('/discharges?status=active&search=dawn')
  fireEvent.click(await screen.findByRole('link', { name: 'Create discharge' }))
  await screen.findByRole('textbox', { name: 'Vessel name' })

  return app
}

/**
 * Types a value and leaves the field, as a user does on the way to the next field or the submit
 * button.
 */
export function change(element: HTMLElement, value: string) {
  fireEvent.change(element, { target: { value } })
  fireEvent.blur(element)
}

/** Moves on from an intermediate step once it is valid, and waits for the next step. */
export async function continueTo(step: 'Product lots' | 'Planned shifts') {
  const next = screen.getByRole('button', { name: `Next: ${step}` })

  // Offered only once the step on screen is valid.
  await waitFor(() => expect(next).toBeEnabled())
  fireEvent.click(next)
  await screen.findByRole('heading', { level: 2, name: step })
}

/** Returns to a step already reached through the step indicator. */
export async function goToStep(step: 'Vessel and dock' | 'Product lots' | 'Planned shifts') {
  const steps = screen.getByRole('navigation', { name: 'Discharge preparation steps' })
  fireEvent.click(within(steps).getByRole('button', { name: new RegExp(step) }))
  await screen.findByRole('heading', { level: 2, name: step })
}

export async function fillVesselStep() {
  change(screen.getByRole('textbox', { name: 'Vessel name' }), 'MV Created Dawn')
  await chooseOption(document.body, 'Dock', AVAILABLE_DOCKS[0].name)
  change(screen.getByLabelText(/^Expected start/), '2026-10-01T06:00')
}

export async function fillLotsStep() {
  const firstLot = screen.getByRole('group', { name: 'Product lot 1' })
  await chooseOption(firstLot, 'Customer', AVAILABLE_CUSTOMERS[0].companyName)
  change(within(firstLot).getByRole('textbox', { name: 'Product name' }), 'Blé tendre')
  change(within(firstLot).getByRole('textbox', { name: 'Expected quantity (t)' }), '1200.5')

  fireEvent.click(screen.getByRole('button', { name: 'Add product lot' }))
  const secondLot = await screen.findByRole('group', { name: 'Product lot 2' })
  await chooseOption(secondLot, 'Customer', AVAILABLE_CUSTOMERS[1].companyName)
  change(within(secondLot).getByRole('textbox', { name: 'Product name' }), 'Orge')
  change(within(secondLot).getByRole('textbox', { name: 'Expected quantity (t)' }), '800')
}

export async function fillShiftsStep() {
  const firstShift = screen.getByRole('group', { name: 'Shift 1' })
  change(within(firstShift).getByLabelText(/^Planned start/), '2026-10-01T14:00')
  change(within(firstShift).getByLabelText(/^Planned end/), '2026-10-01T22:00')
  await chooseOption(firstShift, 'Responsible', RESPONSIBLE_NAME)

  fireEvent.click(screen.getByRole('button', { name: 'Add shift' }))
  const secondShift = await screen.findByRole('group', { name: 'Shift 2' })
  change(within(secondShift).getByLabelText(/^Planned start/), '2026-10-01T06:00')
  change(within(secondShift).getByLabelText(/^Planned end/), '2026-10-01T14:00')
  await chooseOption(secondShift, 'Responsible', RESPONSIBLE_NAME)
}

/** Walks the three steps with valid values and stops on the last one, before creating. */
export async function fillValidPreparation() {
  await fillVesselStep()
  await continueTo('Product lots')
  await fillLotsStep()
  await continueTo('Planned shifts')
  await fillShiftsStep()
}

type DischargeWriteAnswer = { status: number; body: unknown } | 'network-error' | undefined

type MockDischargeCorrectionsOptions = {
  user?: SessionUser
  detail: DischargeDetailDto
  /** Hold the available docks back this long, to observe a field loading its choices. */
  docksDelayMs?: number
  /** Decide the answer to an identity correction; by default it is applied and returned. */
  respondToIdentity?: (body: Record<string, unknown>) => DischargeWriteAnswer
  /** Decide the answer to a lot change; by default it is applied and returned. */
  respondToLot?: (change: {
    method: 'POST' | 'PATCH' | 'DELETE'
    lotId?: string
    body?: Record<string, unknown>
  }) => DischargeWriteAnswer
}

/**
 * Serves one discharge's detail and applies the corrections made to it, as the API would, so a
 * test can tell a detail refreshed from the correction's answer from one fetched again.
 */
export function mockDischargeCorrections({
  user = ACTIVE_OPERATIONS_LEAD,
  detail,
  docksDelayMs = 0,
  respondToIdentity,
  respondToLot,
}: MockDischargeCorrectionsOptions) {
  const state = {
    current: detail,
    detailRequests: 0,
    identityRequests: [] as Record<string, unknown>[],
    lotRequests: [] as Array<{ method: string; lotId?: string; body?: Record<string, unknown> }>,
  }

  const answer = (
    outcome: DischargeWriteAnswer,
    fallback: () => DischargeDetailDto,
    status = 200,
  ) => {
    if (outcome === 'network-error') {
      return HttpResponse.error()
    }
    if (outcome) {
      return HttpResponse.json(outcome.body as object, { status: outcome.status })
    }

    state.current = fallback()
    state.current = { ...state.current, expectedTonnage: totalOf(state.current) }

    return HttpResponse.json({ data: state.current }, { status })
  }

  const lotFromBody = (id: string, body: Record<string, unknown>) => {
    const customer = AVAILABLE_CUSTOMERS.find((candidate) => candidate.id === body.customerId)

    return {
      id,
      productName: body.productName as string,
      description: body.description as string | null,
      expectedQuantityTonnes: Number(body.expectedQuantityTonnes).toFixed(3),
      customer: {
        id: body.customerId as string,
        name: customer?.companyName ?? String(body.customerId),
        status: 'AVAILABLE' as const,
      },
      doorAssignments:
        state.current.productLots.find((lot) => lot.id === id)?.doorAssignments ?? [],
    }
  }

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: user })),
    http.get(`${API_BASE_URL}/api/v1/docks/available`, async () => {
      if (docksDelayMs > 0) {
        await delay(docksDelayMs)
      }

      return HttpResponse.json({ data: AVAILABLE_DOCKS })
    }),
    http.get(`${API_BASE_URL}/api/v1/customers/available`, () =>
      HttpResponse.json({ data: AVAILABLE_CUSTOMERS }),
    ),
    http.get(`${API_BASE_URL}/api/v1/discharges/:id`, () => {
      state.detailRequests += 1

      return HttpResponse.json({ data: state.current })
    }),
    http.patch(`${API_BASE_URL}/api/v1/discharges/:id`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      state.identityRequests.push(body)

      const answer = respondToIdentity?.(body)
      if (answer === 'network-error') {
        return HttpResponse.error()
      }
      if (answer) {
        return HttpResponse.json(answer.body as object, { status: answer.status })
      }

      const dock = AVAILABLE_DOCKS.find((candidate) => candidate.id === body.dockId)
      state.current = {
        ...state.current,
        vesselName: body.vesselName as string,
        vesselImo: body.vesselImo as string | null,
        vesselComment: body.vesselComment as string | null,
        expectedStartAt: body.expectedStartAt as string,
        dock: dock ? { id: dock.id, name: dock.name, status: 'AVAILABLE' } : state.current.dock,
      }

      return HttpResponse.json({ data: state.current })
    }),
    http.post(`${API_BASE_URL}/api/v1/discharges/:id/product-lots`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      state.lotRequests.push({ method: 'POST', body })

      return answer(
        respondToLot?.({ method: 'POST', body }),
        () => ({
          ...state.current,
          productLots: [
            ...state.current.productLots,
            lotFromBody(`added-lot-${state.lotRequests.length}`, body),
          ],
        }),
        201,
      )
    }),
    http.patch(
      `${API_BASE_URL}/api/v1/discharges/:id/product-lots/:lotId`,
      async ({ params, request }) => {
        const body = (await request.json()) as Record<string, unknown>
        const lotId = String(params.lotId)
        state.lotRequests.push({ method: 'PATCH', lotId, body })

        return answer(respondToLot?.({ method: 'PATCH', lotId, body }), () => ({
          ...state.current,
          productLots: state.current.productLots.map((lot) =>
            lot.id === lotId ? lotFromBody(lotId, body) : lot,
          ),
        }))
      },
    ),
    http.delete(`${API_BASE_URL}/api/v1/discharges/:id/product-lots/:lotId`, ({ params }) => {
      const lotId = String(params.lotId)
      state.lotRequests.push({ method: 'DELETE', lotId })

      return answer(respondToLot?.({ method: 'DELETE', lotId }), () => ({
        ...state.current,
        productLots: state.current.productLots.filter((lot) => lot.id !== lotId),
      }))
    }),
  )

  return state
}

function totalOf(detail: DischargeDetailDto) {
  const thousandths = detail.productLots.reduce(
    (total, lot) => total + Math.round(Number(lot.expectedQuantityTonnes) * 1000),
    0,
  )

  return (thousandths / 1000).toFixed(3)
}

/**
 * For test files that fill whole forms: each field validates on blur and each select opens a popup,
 * so a journey through a preparation takes seconds under a loaded parallel run. The time allowed
 * grows for these files only, rather than for the whole suite.
 */
export function allowFormJourneyTime() {
  // Set while the file is collected: a test's timeout is fixed before any hook runs.
  vi.setConfig({ testTimeout: 30_000 })
  beforeAll(() => {
    configure({ asyncUtilTimeout: 10_000 })
  })
  afterAll(() => {
    vi.resetConfig()
    configure({ asyncUtilTimeout: 3_000 })
  })
}
