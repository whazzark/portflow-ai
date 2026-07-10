# Use a monorepo with separate API and web applications

We will build the MVP as a monorepo with `apps/api` for the AdonisJS API and `apps/web` for the TanStack Start frontend. The product will evolve through tightly coupled changes across screens, endpoints, and the discharge domain model, so keeping both applications in one repository reduces coordination overhead while preserving a clear runtime boundary between backend and frontend.
