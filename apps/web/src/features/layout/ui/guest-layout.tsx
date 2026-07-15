import { Outlet } from '@tanstack/react-router'

import { Brand } from '@/features/brand/ui/brand'

export function GuestLayout() {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-[#10233b] text-primary-foreground lg:col-start-2 lg:row-start-1 lg:flex lg:min-h-screen lg:flex-col lg:px-16 lg:py-12 xl:px-20">
        <img
          src="/guest-background-image.png"
          alt=""
          className="absolute inset-0 size-full object-cover object-center opacity-90 dark:opacity-75"
        />
        <div className="absolute inset-0 bg-[linear-gradient(112deg,rgba(16,35,59,0.92)_0%,rgba(16,35,59,0.48)_58%,rgba(16,35,59,0.74)_100%)] dark:bg-[linear-gradient(112deg,rgba(4,17,31,0.88)_0%,rgba(4,17,31,0.42)_58%,rgba(4,17,31,0.76)_100%)]" />

        <Brand className="relative font-semibold text-sm uppercase tracking-[0.16em]" />

        <div className="relative mt-auto max-w-sm lg:mb-1">
          <p className="font-mono text-[0.65rem] text-primary-foreground/65 uppercase tracking-[0.18em]">
            Port operations
          </p>
          <h2 className="mt-3 max-w-[19rem] text-balance font-semibold text-2xl text-primary-foreground leading-tight tracking-tight lg:max-w-md lg:text-4xl">
            Every movement, in one operational view
          </h2>
          <p className="mt-4 hidden max-w-sm text-primary-foreground/80 text-sm leading-6 lg:block">
            Follow vessels, trucks, weighbridges and terminal activity before a handoff becomes a
            delay.
          </p>
        </div>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10 lg:col-start-1 lg:row-start-1 lg:px-16 xl:px-24">
        <Outlet />
      </main>
    </div>
  )
}
