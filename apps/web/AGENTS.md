# Web Agent Instructions

## Structure

- Use `src/features/<feature>/` with `ui/`, `mutations/`, `context/`, `queries/`, and `__tests__/` only when needed.
- Keep route files thin; feature modules own screen behavior. `features/auth` is the explicit shared exception for session and authorization-aware UI.
- Reuse shadcn primitives under `src/components/ui` and the project's `classnames()` helper under `src/libraries/shadcn/helpers`.

## Testing

- Unit tests cover pure adapters, mappers, and small branching rules; they never render React.
- Feature tests render through the real router and providers and are the primary TDD seam.
- E2E tests cover complete journeys against a real API and database; they live under `apps/web/e2e` and are separate from `pnpm test`.
- Use MSW for feature-level network mocking. Never mock the Tuyau client module or hand-roll fetch mocks.

## Forms and UI

- Use `useAppForm`, registered field components, `applyApiError`, `FormError`, and `SubmitButton`.
- Preserve the Channel Marker design tokens and dark-mode provider.
- Test observable user behavior, accessibility states, error handling, and responsive edge cases rather than internal hook composition.
