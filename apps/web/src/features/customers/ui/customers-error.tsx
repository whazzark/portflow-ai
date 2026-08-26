import { ResourceCollectionError } from '@/components/resource-map/resource-map-feedback'

export function CustomersError({ reset }: { reset: () => void }) {
  return <ResourceCollectionError label="customers" onRetry={reset} />
}
