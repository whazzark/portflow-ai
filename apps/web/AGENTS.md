# Web Agent Instructions

## Structure

- Use `src/features/<feature>/` with `ui/`, `mutations/`, `context/`, `queries/`, and `__tests__/` only when needed.
- Keep route files thin; feature modules own screen behavior. `features/auth` is the explicit shared exception for session and authorization-aware UI.
- Reuse shadcn primitives under `src/components/ui` and the project's `classnames()` helper under `src/libraries/shadcn/helpers`.
- Resource-shaped primitives shared by every feature live under `src/components/resource` (detail header, status badge, collection error) and `src/components/lifecycle` (lifecycle copy, dialogs, row actions, bulk actions). Only genuinely map-specific code belongs under `src/components/resource-map`. A primitive filed under the map is one a feature without a map will not find, and will reimplement.

## Routing and URL state

- Anything a user can be halfway through — an open record, an open panel, a filter, a search, a sort — lives in the URL. Not in `useState`. It has to survive a reload and be shareable.
- The open record is named `<resource>Id`. The mode is named `mode` where the route carries one resource, and `<resource>Mode` where it carries several (`/transport-resources`), and takes `view | edit | create`.
- A `create` mode clears its own `<resource>Id` in the route's `transform`, so the two can never contradict each other and no consumer has to decide which wins.
- Deliberate exception: on the maps, `create` and `edit` carry a **resource kind** (`dock | weighing-area`, `warehouse | door`), not a mode. One parameter holding one value is what keeps two creation modes from ever being armed at once. Do not rename these to match the convention above.
- Renaming a search parameter keeps the old name in the schema and rewrites it in the `transform`, so links already in circulation keep working. `routes/_authenticated/checkpoints.tsx` shows the shape; `transport-companies.tsx` shows the heavier variant, a whole route redirecting to its successor.
- Gating a mode in the component keeps the interface honest — a hand-typed `?truckMode=create` opens nothing for a non-administrator — but the API stays authoritative.

## Testing

- Unit tests cover pure adapters, mappers, and small branching rules; they never render React.
- Feature tests render through the real router and providers and are the primary TDD seam.
- E2E tests cover complete journeys against a real API and database; they live under `apps/web/e2e` and are separate from `pnpm test`.
- Use MSW for feature-level network mocking. Never mock the Tuyau client module or hand-roll fetch mocks.

## Forms and UI

- Use `useAppForm`, registered field components, `applyApiError`, `FormError`, and `SubmitButton`. `SubmitButton` takes a `disabled` for a refusal of the form's own; never reimplement it with `form.Subscribe`.
- Write toasts and pending labels from `helpers/resource-copy` and `components/lifecycle/lifecycle-copy`. A feature brings its noun, never its own phrasing.
- Search a collection with `InputSearch`, never a hand-rolled `Input` plus a search icon.
- A detail panel is a `Sheet` at `size="lg"` — the width is a `SheetContent` prop, never a `className`, because the default is a `data-[side=…]` variant a plain `sm:max-w-lg` loses to on specificity — built from `ResourceDetailHeader` / `ResourceDetailBody` / `SheetFooter`. `SheetTitle` names the dialog, so scope it in tests with `getByRole('dialog')` rather than a labelled region.
- An edit panel is left through its header's "Back to details". A creation panel adds an explicit `Cancel` only where its sheet is unmodal over a map, since a click outside dismisses nothing there.
- An empty collection renders `Empty`, and offers its create action to an administrator when no search is narrowing it.
- Status filters: tabs for a directory, the filter dropdown for a map, a `Select` for a secondary facet such as a role. Status vocabularies are the domain's and are not harmonised across resources.
- Preserve the Channel Marker design tokens and dark-mode provider.
- Test observable user behavior, accessibility states, error handling, and responsive edge cases rather than internal hook composition.
