# Web Agent Notes

## Design system

- UI primitives come from shadcn/ui (`src/components/ui`, `components.json`), themed with the "Channel Marker" brand tokens in `src/styles/globals.css`. Prefer an existing primitive or a `shadcn add`-ed component over hand-rolled markup.
- shadcn's `cn()` helper is renamed to `classnames()` and lives at `src/libraries/shadcn/helpers.ts` (not the default `src/lib/utils.ts`), matching this project's `libraries` convention for tool integrations. The shadcn CLI always generates `import { cn } from "@/libraries/shadcn/helpers"` — after every `npx shadcn add <component>` (or `add --overwrite`/update), fix that import to `classnames` and update any `cn(...)` call sites in the added file(s) before committing.
- Harbor Control defaults to dark mode through the custom provider at `src/libraries/theme/` (`ThemeProvider`, `useTheme`), not `next-themes` — this is a Vite/TanStack Start app, not Next.js. The explicit `light` preference is stored in `portflow-theme`.

## Feature folder structure

- Each feature under `src/features/<feature>/` groups its internals by technical role, not by screen: `ui/` for screen and component UI, `mutations/` for TanStack Query mutation hooks, `context/` for React context providers and their hooks, `__tests__/` for that feature's tests. See `src/features/auth/` for the established layout.
- This convention is intentionally minimal today (`ui`, `mutations`, `context`, `__tests__`) and expected to grow new subfolders (for example `queries/`) as later features need them — do not pre-create empty subfolders a feature doesn't use yet.
- Authentication is an explicit exception to feature isolation: `features/auth` is the one feature every other feature may import from for session and authorization-aware UI. See `docs/adr/0008-vertical-slice-web-frontend-with-explicit-ui-adapters.md`.

## Test levels

- Three levels only: unit, feature, e2e. There is no separate isolated-component-test level — test components through the feature level instead. See `docs/adr/0001-frontend-testing-strategy.md` for the full rationale.
- **Unit** — pure non-React logic only: adapters, mappers, small branching business rules (for example `parseApiError`). Never renders anything, never calls `renderHook` or otherwise exercises a hook in isolation. Colocate as `*.test.ts` next to the source file.
- **Feature** — one integration-style seam per feature, rendered through the real router and real providers (see `src/features/auth/__tests__/auth-flow.test.tsx` for the established pattern). This is the day-to-day layer TDD's red-green-refactor loop drives. Colocate as `*.test.tsx` under the feature's `__tests__/` folder.
- **E2E** — a comprehensive suite of full user journeys against a real `apps/api` instance and a real database, never MSW. Written after a feature is already green at the feature level, as a safety net for what a mocked environment can't catch (SSR assembly, hydration, real network) — not TDD'd behavior-by-behavior. Lives under `apps/web/e2e/*.spec.ts`, configured by `apps/web/playwright.config.ts`.
- Cross-cutting providers under `src/libraries/*` (for example `ThemeProvider`) sit outside any single feature, so there is no natural "feature level" to test them through. These may have a colocated `*.test.tsx` that renders the provider in isolation with a minimal local probe component, as a deliberate exception to the no-isolated-component-test rule. Keep this exception scoped to `src/libraries/`; feature-owned components still go through the feature level.

## Feature-level mocking

- Mock the network with MSW (`msw/node`, `setupServer`), never the Tuyau client module and never a hand-rolled `ky`/fetch mock — both bypass Tuyau's real request-building and error-wrapping code.
- Global setup lives in `src/test/setup.ts`; MSW server and handlers live under `src/test/msw/`. Add new handlers there rather than inlining `server.use(...)` overrides scattered across test files, unless a single test needs a one-off response.
- Use MSW to simulate states a real backend can't produce deterministically in an automated suite, such as a genuine network failure (`HttpResponse.error()` → `TuyauNetworkError`).

## Forms

- Build application forms with `useAppForm` from `src/libraries/forms`. It composes TanStack Form with the shared shadcn field primitives, so features should use `form.AppField` and the registered field components rather than bind values, errors, or ARIA attributes manually.
- Keep a form's Zod schema, default values, and mutation in its feature. In `onSubmit`, await the mutation and call `applyApiError(formApi, error)` to display API errors in the form and attach API field details when available.
- Use `form.FormError` for submission failures and `form.SubmitButton` for submission state. Do not show a toast for an error caused by a form submission.

## Running tests

- `pnpm test` — unit + feature suite (Vitest, jsdom). Fast; this is the TDD loop.
- `pnpm e2e` — Playwright suite against a real `apps/api` + real database. Requires both services running; not part of `pnpm test` or the `test` turbo task on purpose, so it never rides along with the fast gate. Runs in CI as its own decoupled job (`.github/workflows/e2e.yml`), not folded into `ci-checks.yml`.

## Out of scope

- Visual regression / screenshot testing.
- Automated accessibility (a11y) testing.
