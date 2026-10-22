import { Outlet } from '@tanstack/react-router'

export function GuestLayout() {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-background">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <style data-theme-background-visibility>{`
          #guest-background-dark{display:none}
          html.dark #guest-background-dark{display:block}
          html.dark #guest-background-light{display:none}
        `}</style>
        <img
          id="guest-background-dark"
          src="/guest-background-image.png"
          alt=""
          className="absolute inset-0 hidden size-full object-cover object-center dark:block"
        />
        <img
          id="guest-background-light"
          src="/guest-background-image-light.png"
          alt=""
          className="absolute inset-0 size-full object-cover object-center dark:hidden"
        />
        {/* Mutes the chart so the card, not the background, holds the eye. */}
        <div className="absolute inset-0 bg-background/40 dark:bg-background/62" />
      </div>

      {/* The bottom padding clears the tagline, pinned to the corner on desktop, on a short window. */}
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:pb-24">
        <Outlet />
      </main>

      <footer className="flex flex-wrap gap-x-2.5 gap-y-1 px-6 pb-9 text-[0.8125rem] text-foreground/80 lg:absolute lg:bottom-9 lg:left-12 lg:p-0">
        <span className="font-mono text-indicator uppercase tracking-[0.16em]">
          Port operations
        </span>
        <span>Every movement, in one operational view</span>
      </footer>
    </div>
  )
}
