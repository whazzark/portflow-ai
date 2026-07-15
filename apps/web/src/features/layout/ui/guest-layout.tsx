import { Outlet } from '@tanstack/react-router'

export function GuestLayout() {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden lg:col-start-2 lg:row-start-1 lg:flex lg:min-h-screen lg:flex-col lg:px-16 lg:py-12 xl:px-20">
        <style data-theme-background-visibility>{`
          #guest-background-dark{display:none}
          html.dark #guest-background-dark{display:block}
          html.dark #guest-background-light{display:none}
        `}</style>
        <img
          id="guest-background-dark"
          src="/guest-background-image.png"
          alt=""
          className="absolute inset-0 hidden size-full object-cover object-center opacity-90 dark:block dark:opacity-75"
        />
        <img
          id="guest-background-light"
          src="/guest-background-image-light.png"
          alt=""
          className="absolute inset-0 size-full object-cover object-center opacity-90 dark:hidden dark:opacity-75"
        />

        <div className="relative mt-auto max-w-sm lg:mb-1">
          <p className="font-mono text-sm uppercase tracking-[0.18em]">Port operations</p>
          <h2 className="mt-3 max-w-[19rem] text-balance font-semibold text-2xl leading-tight tracking-tight lg:max-w-md lg:text-4xl">
            Every movement, in one operational view
          </h2>
          <p className="mt-4 hidden max-w-sm text-md leading-6 lg:block">
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
