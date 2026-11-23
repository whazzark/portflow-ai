import type { ReactNode } from 'react'
import { Brand } from '@/components/brand/brand'

/**
 * The one surface every guest screen — sign-in, activation, password renewal — stands on, centred
 * over the port background by `GuestLayout`. Each child is a block of the card, spaced like the
 * header, so a screen lays out its form and any secondary action as siblings.
 */
export function GuestCard({
  children,
  description,
  title,
}: {
  children: ReactNode
  description: ReactNode
  title: string
}) {
  return (
    <div
      data-slot="guest-card"
      className="flex w-full max-w-md flex-col gap-7 rounded-[0.875rem] border bg-card/94 p-6 text-card-foreground shadow-[0_24px_64px] shadow-foreground/18 sm:p-10 dark:bg-background/94 dark:shadow-black/55"
    >
      <Brand tone="inverse" className="w-28" />
      <div className="flex flex-col gap-2.5">
        <h1 className="text-balance font-semibold text-[1.75rem] leading-tight tracking-[-0.01em]">
          {title}
        </h1>
        <p className="text-pretty text-muted-foreground text-sm leading-6">{description}</p>
      </div>
      {children}
    </div>
  )
}
