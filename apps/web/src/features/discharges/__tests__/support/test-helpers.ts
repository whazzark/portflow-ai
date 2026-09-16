import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, HttpResponse, http } from 'msw'
import { afterAll, beforeAll, expect, vi } from 'vitest'

import type { SessionUser } from '@/features/auth/context/session-context'
import type {
  DischargeDetailDto,
  DischargeDetailTab,
  DischargeDto,
  TruckCandidateDto,
} from '@/features/discharges/types'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import {
  ACTIVE_OBSERVER,
  ACTIVE_OPERATIONS_LEAD,
  API_BASE_URL,
  AVAILABLE_CUSTOMERS,
  AVAILABLE_DOCKS,
  AVAILABLE_WEIGHING_AREAS,
  DISCHARGE_DETAILS,
  DISCHARGES,
  ELIGIBLE_RESPONSIBLES,
  SHIFT_WAREHOUSES,
  TRUCK_CANDIDATES,
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

/** A discharge opened on one of its sections, as a shared address names it. */
export function renderDischargeTab(id: string, tab: DischargeDetailTab, search = '') {
  const params = new URLSearchParams(search.replace(/^\?/, ''))
  params.set('tab', tab)

  return renderApp(`/discharges/${id}?${params}`)
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

/** The product row of a customer block, as `Customer 1` › `Product 1`. */
export function productRow(block: number, product: number) {
  const customerBlock = screen.getByRole('group', { name: `Customer ${block}` })

  return within(customerBlock).getByRole('group', { name: `Product ${product}` })
}

/** Types a product row's name and expected quantity. */
export function fillProduct(row: HTMLElement, productName: string, quantity: string) {
  change(within(row).getByRole('textbox', { name: 'Product name' }), productName)
  change(within(row).getByRole('textbox', { name: 'Expected quantity (t)' }), quantity)
}

/** Fills a customer block whose customer and first product are still empty. */
export async function fillCustomerBlock(
  block: number,
  customerName: string,
  productName: string,
  quantity: string,
) {
  const customerBlock = await screen.findByRole('group', { name: `Customer ${block}` })
  await chooseOption(customerBlock, 'Customer', customerName)
  fillProduct(productRow(block, 1), productName, quantity)
}

export async function fillLotsStep() {
  await fillCustomerBlock(1, AVAILABLE_CUSTOMERS[0].companyName, 'Blé tendre', '1200.5')

  fireEvent.click(screen.getByRole('button', { name: 'Add customer' }))
  await fillCustomerBlock(2, AVAILABLE_CUSTOMERS[1].companyName, 'Orge', '800')
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

export type DischargeWriteAnswer = { status: number; body: unknown } | 'network-error' | undefined

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
  /** Decide the answer to a customer's lots corrected at once; by default it is applied. */
  respondToCustomerLots?: (change: {
    customerId: string
    body: CustomerLotsBody
  }) => DischargeWriteAnswer
}

type CustomerLotsBody = {
  customerId: string
  productLots: Array<Record<string, unknown> & { id?: string }>
  removedProductLotIds: string[]
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
  respondToCustomerLots,
}: MockDischargeCorrectionsOptions) {
  const state = {
    current: detail,
    detailRequests: 0,
    identityRequests: [] as Record<string, unknown>[],
    lotRequests: [] as Array<{ method: string; lotId?: string; body?: Record<string, unknown> }>,
    customerLotRequests: [] as Array<{ customerId: string; body: CustomerLotsBody }>,
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
      const body = (await request.json()) as { productLots: Record<string, unknown>[] }
      state.lotRequests.push({ method: 'POST', body })
      const requestNumber = state.lotRequests.length

      return answer(
        respondToLot?.({ method: 'POST', body }),
        () => ({
          ...state.current,
          productLots: [
            ...state.current.productLots,
            ...body.productLots.map((lot, index) =>
              lotFromBody(`added-lot-${requestNumber}-${index + 1}`, lot),
            ),
          ],
        }),
        201,
      )
    }),
    http.patch(
      `${API_BASE_URL}/api/v1/discharges/:id/customers/:customerId/product-lots`,
      async ({ params, request }) => {
        const body = (await request.json()) as CustomerLotsBody
        const customerId = String(params.customerId)
        state.customerLotRequests.push({ customerId, body })
        const requestNumber = state.customerLotRequests.length

        return answer(respondToCustomerLots?.({ customerId, body }), () => {
          const withCustomer = (lot: ReturnType<typeof lotFromBody>) => {
            const current = state.current.productLots.find(
              (candidate) => candidate.customer.id === body.customerId,
            )

            return current && !AVAILABLE_CUSTOMERS.some((known) => known.id === body.customerId)
              ? { ...lot, customer: current.customer }
              : lot
          }
          const corrected = state.current.productLots
            .filter((lot) => !body.removedProductLotIds.includes(lot.id))
            .map((lot) => {
              const entry = body.productLots.find((candidate) => candidate.id === lot.id)

              return entry
                ? withCustomer(lotFromBody(lot.id, { ...entry, customerId: body.customerId }))
                : lot
            })
          const added = body.productLots
            .filter((entry) => entry.id === undefined)
            .map((entry, index) =>
              withCustomer(
                lotFromBody(`lot-added-${requestNumber}-${index + 1}`, {
                  ...entry,
                  customerId: body.customerId,
                }),
              ),
            )

          return { ...state.current, productLots: [...corrected, ...added] }
        })
      },
    ),
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

type MockTruckPlanningOptions = {
  user?: SessionUser
  detail: DischargeDetailDto
  candidates?: TruckCandidateDto[]
  /** Decide the answer to the candidates read; by default the candidates are listed. */
  respondToCandidates?: () => DischargeWriteAnswer
  /** Decide the answer to a reservation; by default it is applied and returned. */
  respondToReserve?: (truckIds: string[]) => DischargeWriteAnswer
  /** Decide the answer to a withdrawal; by default it is applied and returned. */
  respondToWithdraw?: (truckIds: string[]) => DischargeWriteAnswer
  /** Decide the answer to a shift correction; by default it is applied and returned. */
  respondToShift?: (shiftId: string, body: ShiftCorrectionBody) => DischargeWriteAnswer
}

export type ShiftCorrectionBody = {
  plannedStartAt: string
  plannedEndAt: string
  responsibleUserId: string
  truckIds: string[]
  warehouseDoorIds: string[]
  weighingAreaIds: string[]
}

/**
 * Serves one discharge's detail, its truck candidates, and the choices a shift correction offers, and
 * applies reservations, withdrawals, and shift corrections to that detail as the API would. A test can then tell a detail refreshed from a
 * write's answer from one fetched again, and replace any answer to reach a refusal.
 */
export function mockTruckPlanning({
  user = ACTIVE_OPERATIONS_LEAD,
  detail,
  candidates = TRUCK_CANDIDATES,
  respondToCandidates,
  respondToReserve,
  respondToWithdraw,
  respondToShift,
}: MockTruckPlanningOptions) {
  const state = {
    current: detail,
    detailRequests: 0,
    candidateRequests: 0,
    requests: [] as Array<
      | { kind: 'reserve' | 'withdraw'; truckIds: string[] }
      | { kind: 'shift'; shiftId: string; body: ShiftCorrectionBody }
    >,
  }

  const answer = (outcome: DischargeWriteAnswer, apply: () => DischargeDetailDto) => {
    if (outcome === 'network-error') {
      return HttpResponse.error()
    }
    if (outcome) {
      return HttpResponse.json(outcome.body as object, { status: outcome.status })
    }

    state.current = apply()

    return HttpResponse.json({ data: state.current })
  }

  const isCurrent = (row: { effectiveTo: string | null }) => row.effectiveTo === null
  const registrationOf = (truckId: string) =>
    state.current.truckPool.find((entry) => entry.truckId === truckId)?.registration ?? truckId

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: user })),
    http.get(`${API_BASE_URL}/api/v1/discharges/:id`, () => {
      state.detailRequests += 1

      return HttpResponse.json({ data: state.current })
    }),
    http.get(`${API_BASE_URL}/api/v1/users/eligible-shift-responsibles`, () =>
      HttpResponse.json({ data: ELIGIBLE_RESPONSIBLES }),
    ),
    http.get(`${API_BASE_URL}/api/v1/warehouses`, () =>
      HttpResponse.json({ data: SHIFT_WAREHOUSES }),
    ),
    http.get(`${API_BASE_URL}/api/v1/weighing-areas/available`, () =>
      HttpResponse.json({ data: AVAILABLE_WEIGHING_AREAS }),
    ),
    http.get(`${API_BASE_URL}/api/v1/discharges/:id/truck-pool/candidates`, () => {
      state.candidateRequests += 1

      const outcome = respondToCandidates?.()
      if (outcome === 'network-error') {
        return HttpResponse.error()
      }
      if (outcome) {
        return HttpResponse.json(outcome.body as object, { status: outcome.status })
      }

      const held = new Set(
        state.current.truckPool
          .filter((entry) => entry.releasedAt === null)
          .map((entry) => entry.truckId),
      )

      return HttpResponse.json({ data: candidates.filter((candidate) => !held.has(candidate.id)) })
    }),
    http.post(`${API_BASE_URL}/api/v1/discharges/:id/truck-pool`, async ({ request }) => {
      const { truckIds } = (await request.json()) as { truckIds: string[] }
      state.requests.push({ kind: 'reserve', truckIds })

      return answer(respondToReserve?.(truckIds), () => {
        const reserved = candidates
          .filter((candidate) => truckIds.includes(candidate.id))
          .map((candidate) => ({
            id: `pool-${candidate.id}`,
            truckId: candidate.id,
            registration: candidate.registration,
            truckStatus: 'AVAILABLE' as const,
            transportCompany: { ...candidate.transportCompany, status: 'AVAILABLE' as const },
            reservedAt: '2026-09-15T08:00:00.000Z',
            releasedAt: null,
            otherHoldings: candidate.otherHoldings,
          }))

        return { ...state.current, truckPool: [...state.current.truckPool, ...reserved] }
      })
    }),
    http.post(
      `${API_BASE_URL}/api/v1/discharges/:id/truck-pool/withdrawals`,
      async ({ request }) => {
        const { truckIds } = (await request.json()) as { truckIds: string[] }
        state.requests.push({ kind: 'withdraw', truckIds })

        return answer(respondToWithdraw?.(truckIds), () => ({
          ...state.current,
          truckPool: state.current.truckPool.filter(
            (entry) => entry.releasedAt !== null || !truckIds.includes(entry.truckId),
          ),
          shifts: state.current.shifts.map((shift) =>
            shift.status === 'PLANNED'
              ? {
                  ...shift,
                  trucks: shift.trucks.filter(
                    (truck) => !isCurrent(truck) || !truckIds.includes(truck.truckId),
                  ),
                }
              : shift,
          ),
        }))
      },
    ),
    http.put(
      `${API_BASE_URL}/api/v1/discharges/:id/shifts/:shiftId`,
      async ({ params, request }) => {
        const body = (await request.json()) as ShiftCorrectionBody
        const shiftId = String(params.shiftId)
        state.requests.push({ kind: 'shift', shiftId, body })

        const keep = <Row extends { effectiveTo: string | null }>(
          rows: Row[],
          ids: string[],
          idOf: (row: Row) => string,
        ) => rows.filter((row) => !isCurrent(row) || ids.includes(idOf(row)))
        const addedIds = <Row extends { effectiveTo: string | null }>(
          kept: Row[],
          ids: string[],
          idOf: (row: Row) => string,
        ) => {
          const keptIds = new Set(kept.filter(isCurrent).map(idOf))
          return ids.filter((id) => !keptIds.has(id))
        }
        const selection = { effectiveFrom: '2026-09-15T08:00:00.000Z', effectiveTo: null }

        return answer(respondToShift?.(shiftId, body), () => ({
          ...state.current,
          shifts: state.current.shifts.map((shift) => {
            if (shift.id !== shiftId) {
              return shift
            }

            const responsible =
              ELIGIBLE_RESPONSIBLES.find((user) => user.id === body.responsibleUserId) ??
              shift.responsible
            const trucks = keep(shift.trucks, body.truckIds, (truck) => truck.truckId)
            const doors = keep(
              shift.warehouseDoors,
              body.warehouseDoorIds,
              (door) => door.warehouseDoor.id,
            )
            const areas = keep(
              shift.weighingAreas,
              body.weighingAreaIds,
              (area) => area.weighingArea.id,
            )

            return {
              ...shift,
              plannedStartAt: body.plannedStartAt,
              plannedEndAt: body.plannedEndAt,
              responsible,
              trucks: [
                ...trucks,
                ...addedIds(trucks, body.truckIds, (truck) => truck.truckId).map((truckId) => ({
                  id: `selection-${shiftId}-${truckId}`,
                  truckId,
                  registration: registrationOf(truckId),
                  truckStatus: 'AVAILABLE' as const,
                  ...selection,
                })),
              ],
              warehouseDoors: [
                ...doors,
                ...addedIds(doors, body.warehouseDoorIds, (door) => door.warehouseDoor.id).flatMap(
                  (doorId) =>
                    SHIFT_WAREHOUSES.flatMap((warehouse) =>
                      warehouse.doors
                        .filter((door) => door.id === doorId)
                        .map((door) => ({
                          id: `selection-${shiftId}-${doorId}`,
                          warehouseDoor: door,
                          warehouse: {
                            id: warehouse.id,
                            name: warehouse.name,
                            status: warehouse.status,
                          },
                          ...selection,
                        })),
                    ),
                ),
              ],
              weighingAreas: [
                ...areas,
                ...addedIds(areas, body.weighingAreaIds, (area) => area.weighingArea.id).flatMap(
                  (areaId) =>
                    AVAILABLE_WEIGHING_AREAS.filter((area) => area.id === areaId).map((area) => ({
                      id: `selection-${shiftId}-${areaId}`,
                      weighingArea: area,
                      ...selection,
                    })),
                ),
              ],
            }
          }),
        }))
      },
    ),
  )

  return state
}

/**
 * Opens a product lot's menu, named `Customer · Product`, and returns its items. The menu is
 * portaled out of the table, so its items are queried from `screen`.
 */
export async function openLotMenu(lotName: string) {
  const lots = await screen.findByRole('region', { name: 'Product lots' })
  fireEvent.click(within(lots).getByRole('button', { name: `Actions for ${lotName}` }))

  return screen.findByRole('menu')
}
