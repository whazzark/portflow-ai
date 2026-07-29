import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test, vi } from 'vitest'
import type { BulkCustomerLifecycleBlocker } from '@/features/customers/types'
import { BulkLifecycleActions } from '@/features/customers/ui/bulk-lifecycle-actions'
import { server } from '@/test/msw/server'
import { API_BASE_URL } from '../support/fixtures'

test.each([
  ['NOT_FOUND', false, 'archive', 'Archive selected', 'not found'],
  ['ALREADY_ARCHIVED', false, 'archive', 'Archive selected', 'already archived'],
  ['ALREADY_AVAILABLE', true, 'reactivate', 'Reactivate selected', 'already available'],
] as const)(
  'keeps a stale %s blocker actionable without a refreshed customer DTO',
  async (reason, isArchived, endpoint, openLabel, reasonLabel) => {
    const selectedId = 'stale-customer-id'
    const blocker: BulkCustomerLifecycleBlocker = {
      id: selectedId,
      code: reason === 'NOT_FOUND' ? undefined : 'STALE-01',
      companyName: reason === 'NOT_FOUND' ? undefined : 'Stale Customer',
      reason,
    }
    let requestBody: unknown
    const onClear = vi.fn()
    const onSuccess = vi.fn()

    server.use(
      http.post(`${API_BASE_URL}/api/v1/customers/${endpoint}`, async ({ request }) => {
        requestBody = await request.json()
        return HttpResponse.json({
          data: { updatedCustomers: [], blockedCustomers: [blocker] },
        })
      }),
    )

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <BulkLifecycleActions
          blockedCustomers={[blocker]}
          isArchived={isArchived}
          onClear={onClear}
          onSuccess={onSuccess}
          selectedIds={[selectedId]}
        />
      </QueryClientProvider>,
    )

    expect(screen.getByText('Some customers were unchanged')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(reasonLabel))).toBeInTheDocument()
    expect(screen.getByText('1 selected')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: openLabel })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry blocked customers' }))
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: isArchived ? 'Reactivate' : 'Archive',
      }),
    )

    await waitFor(() => {
      expect(requestBody).toEqual({ ids: [selectedId], comment: null })
      expect(onSuccess).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(onClear).toHaveBeenCalledOnce()
  },
)
