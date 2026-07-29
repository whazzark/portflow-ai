import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { CustomerSheet } from '@/features/customers/ui/customer-sheet'

test('renders a stale customer alert with valid description markup', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  const queryClient = new QueryClient()

  render(
    <QueryClientProvider client={queryClient}>
      <CustomerSheet
        canAdminister={true}
        customerId="missing-customer"
        mode="view"
        onChange={vi.fn()}
      />
    </QueryClientProvider>,
  )

  expect(await screen.findByText('Customer details unavailable')).toBeInTheDocument()
  expect(
    consoleError.mock.calls.some((call) =>
      call.some((value) => String(value).includes('cannot be a descendant of <p>')),
    ),
  ).toBe(false)
  consoleError.mockRestore()
})
