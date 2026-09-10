import { ResourceCollectionError } from '@/components/resource/resource-feedback'

export function CustomersError({ reset }: { reset: () => void }) {
  return <ResourceCollectionError label="customers" onRetry={reset} />
}
