import type { LucideIcon } from 'lucide-react'

export type NavigationItem = {
  label: string
  icon: LucideIcon
  href?: string
}

export type NavigationGroup = {
  label: string
  items: NavigationItem[]
}
