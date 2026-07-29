import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react'

export function SortIcon({ direction }: { direction: false | 'asc' | 'desc' }) {
  if (direction === 'asc') {
    return <ArrowUpIcon aria-hidden="true" />
  }

  if (direction === 'desc') {
    return <ArrowDownIcon aria-hidden="true" />
  }

  return <ArrowUpDownIcon aria-hidden="true" />
}
