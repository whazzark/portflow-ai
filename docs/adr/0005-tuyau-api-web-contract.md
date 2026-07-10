# Use Tuyau as the typed API-web contract

We will use Tuyau as the official TypeScript contract between `apps/api` and `apps/web`, while keeping the backend exposed as a versioned REST JSON API under `/api/v1`. This avoids manually duplicating request and response shapes in the TanStack Start frontend, without changing the REST boundary chosen for the MVP or introducing GraphQL/tRPC-style coupling. Since the API foundation is AdonisJS 7, we will use the current Tuyau package line rather than the legacy AdonisJS 6-compatible branch.

Tuyau route names will describe the application surface without the HTTP version prefix, for example `auth.login`, `discharges.index`, and `rotations.complete`, even when the underlying URLs remain under `/api/v1`.

Controller responses exposed through Tuyau will use explicit DTOs rather than raw Lucid models or SQL rows. This keeps the frontend contract stable, camelCase, and focused on the application surface instead of leaking database columns or internal persistence details.

Mutation request bodies will be inferred from Vine validators used directly in controller actions. We will not duplicate input DTOs in TypeScript unless a non-HTTP boundary needs them later.

Generic REST endpoints that multiplex different resource shapes through path parameters will be avoided for the typed frontend contract. Site references will be exposed as named resources such as `customers`, `trucks`, `warehouses`, and `warehouseDoors`, even when they share implementation internally.

The first Tuyau integration will expose a typed route skeleton for all MVP API areas, including users, product lots, warehouse door assignments, shifts, downtimes, rotation adjustments, and report snapshots. This gives the frontend a coherent contract early, while individual business workflows can still deepen incrementally.

Routes for workflows that are not implemented yet may return explicit typed `501 Not Implemented` responses. This makes the contract discoverable without pretending the business behavior is available.

API errors exposed to the frontend will use a shared shape with `code`, `message`, and optional `details`. This gives the frontend stable branching keys while still allowing validation details or business-rule context to be returned when useful.

DTOs belong to `apps/api` and are exposed to the frontend through Tuyau. We will not create a separate shared DTO package unless another consumer needs the API contract outside the Tuyau registry.
