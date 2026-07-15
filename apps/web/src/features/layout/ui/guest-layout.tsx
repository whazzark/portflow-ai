import { Outlet } from '@tanstack/react-router'

export function GuestLayout() {
  return (
    <div className="flex min-h-screen">
      <div />
      <main className="flex flex-1 items-center justify-center">
        <Outlet />
      </main>
    </div>
  )
}
