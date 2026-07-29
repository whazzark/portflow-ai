# Research: Administer Docks and Weighing Areas From the Web Workbench

## Decision: Extend the two existing API vertical slices and add one checkpoints web feature

**Rationale**: `apps/api/app/docks/` and `apps/api/app/weighing_areas/` already own distinct models, repositories, policies, validators, transformers, use cases, controllers, and HTTP routes, including single-resource GET routes. Their delivered name, GPS, uniqueness, availability, lifecycle metadata, and usage-checker behavior are the implementation baseline. The web has no checkpoint feature yet, so one `apps/web/src/features/checkpoints/` slice will compose the two named Tuyau resources without introducing a `Checkpoint` entity or generic API endpoint. Details are opened from list results rather than adding or depending on another read path.

**Alternatives considered**: Replacing the API slices with one generic site-reference controller or creating a persistent `Checkpoint` supertype. Both conflict with the REST/Tuyau decision to expose named resources and with the domain definition of Checkpoint as an interface category rather than an entity. Copying the customer web feature twice would duplicate lifecycle and selection behavior inside one workbench.

## Decision: Use an integer resource version as the optimistic-concurrency token

**Rationale**: Add a non-null positive `version` column, initialized to `1`, to both existing tables. Every successful update, archive, or reactivation increments it. Requests that mutate an existing resource carry the version the administrator observed; repositories perform a conditional write against both identity and version and return a typed `STALE_VERSION` result when the current version differs. An integer token is explicit, monotonically increasing, portable across PostgreSQL and the SQLite test database, and does not depend on timestamp precision or client date parsing.

**Alternatives considered**: Using `updatedAt` as an implicit token risks precision and serialization mismatches. HTTP `ETag`/`If-Match` would be standards-based but would add header handling outside the repository's current Vine/Tuyau body contract. Pessimistic locks held across a browser edit are not viable and would not provide a recoverable stale-workbench flow.

## Decision: Make grouped lifecycle commands versioned, transactional partial-success operations

**Rationale**: Each resource-specific grouped endpoint accepts ordered `{ id, expectedVersion }` items. The use case obtains archive-usage facts through `SiteReferenceUsageChecker`; the named repository then locks found rows in one transaction, classifies each requested item in request order using those facts, updates every eligible row with a conditional version increment, leaves blocked rows unchanged, and commits eligible changes even when blockers exist. Blocker reasons are `NOT_FOUND`, `STALE_VERSION`, `IN_USE`, `ALREADY_ARCHIVED`, and `ALREADY_AVAILABLE`. Classification checks missing identity first, then stale version, then lifecycle state, then archive usage, ensuring outdated intent is never silently applied to a changed record.

**Alternatives considered**: An all-or-nothing grouped write violates the clarified partial-success requirement. Sending one HTTP request per row makes selection-level feedback and concurrency behavior client-orchestrated. Accepting only IDs would allow a grouped action based on stale data to overwrite a newer lifecycle decision.

## Decision: Keep lifecycle and authorization authority in the API

**Rationale**: Active authenticated users may list and view both resource types; only `ORGANIZATION_ADMIN` and `OPERATIONS_ADMIN` may create or mutate them. Policies remain authoritative at every controller action. Use cases normalize input and map typed repository outcomes to domain exceptions; repositories own conditional writes, locks, and single-operation transactions; controllers own Vine validation, actor/time capture, HTTP status, and transformation.

**Alternatives considered**: Client-only role checks cannot protect direct callers or stale screens. Controller-owned concurrency checks would race between reading and writing. Repository-thrown HTTP exceptions would violate the use-case/repository boundary ADR.

## Decision: Preserve separate case-insensitive uniqueness scopes and add no cross-type constraint

**Rationale**: The existing functional unique indexes on `LOWER(name)` already enforce case-insensitive uniqueness within `docks` and within `weighing_areas`. Because the resources remain in separate tables, a dock and a weighing area may share a name as required. The version migration augments the current tables and leaves identity and uniqueness indexes intact.

**Alternatives considered**: A shared name registry would incorrectly prohibit cross-type duplicates and add a new source of truth. Application-only duplicate checks would race and weaken the existing database guarantee.

## Decision: Reuse the site-reference usage boundary until GH-53 makes discharges durable

**Rationale**: The current schema has no discharge or dock/weighing-area assignment tables. GH-41 keeps `SiteReferenceUsageChecker` as the domain boundary, verifies both used and unused outcomes, and uses the existing `DOCK` and `WEIGHING_AREA` reference types. Production may remain bound to `NoDischargeSiteReferenceUsageChecker` only while planned and active references cannot be persisted. GH-53 must replace that binding and make usage inspection plus lifecycle mutation transactionally consistent when it introduces the first durable discharge references.

**Alternatives considered**: Pulling a partial discharge model into GH-41 would merge separate delivery units. Ignoring the boundary would make the later archival rule easy to bypass. Blocking every archive until GH-53 would reject all currently valid operations.

## Decision: Expose lifecycle actor summaries and versions in the named DTOs

**Rationale**: The existing dock and weighing-area transformers expose actor IDs but do not preload or serialize actor summaries. The workbench needs stable, human-readable lifecycle history and the current version token. Both models will add the same actor relations already used by customers; repositories will preload them for list and mutation results; transformers will expose `archivedBy`, `reactivatedBy`, and `version` while keeping the named Dock and Weighing Area DTOs distinct. The detail sheet uses the selected list item rather than a new single-resource GET request.

**Alternatives considered**: Showing raw actor UUIDs is not usable workbench feedback. A second request per actor would create avoidable client joins. A generic checkpoint DTO would erase the named Tuyau resources without providing a domain benefit.

## Decision: Use URL-backed independent state inside one `/checkpoints` workbench

**Rationale**: The authenticated route owns visible resource types plus independent URL-backed name search, availability status, and sorting for Docks and Weighing Areas. Changing one type's search preserves its selected status and the other type's state. The map composes the two filtered result sets and renders existing latitude/longitude points with distinct icons; color reinforces type/status but is not the sole signal. Feature-local state owns marker selection, dialogs, and partial-result feedback. An accessible synchronized list supports keyboard and screen-reader inspection. A resource sheet supports create, view, and edit; grouped lifecycle uses a selection toolbar and confirmation dialog.

**Alternatives considered**: Separate `/docks` and `/weighing-areas` pages would not provide the requested single workbench. A table-only workbench would hide the spatial relationship between references. A global client store would duplicate URL and TanStack Query state.

## Decision: Use MapCN with its owned MapLibre component and default CARTO styles

**Rationale**: The human selected MapCN. Its shadcn registry command copies the map component into the application and installs `maplibre-gl`, matching Portflow's owned shadcn component model, Tailwind styling, and light/dark themes. The workbench will use MapCN markers and controls with the default theme-aware CARTO basemap styles and visible attribution. Because MapLibre needs browser canvas/WebGL and remote styles/tiles, only the canvas mounts in a hydration-safe client boundary; the route shell, filters, failure feedback, and synchronized accessible list remain usable during SSR and when the map cannot load.

**Alternatives considered**: A direct MapLibre integration would duplicate the composition MapCN already supplies. Leaflet would add a different component and rendering model. A dependency-free coordinate plot would lack geographic context. Mapbox or Google Maps would introduce proprietary SDK credentials and billing.

**Primary references**: [MapCN introduction](https://www.mapcn.dev/docs), [MapCN installation](https://www.mapcn.dev/docs/installation), and [MapCN API reference](https://www.mapcn.dev/docs/api-reference).

## Decision: Follow the established Channel Marker UI and accessible map patterns

**Rationale**: The existing IBM Plex typography, theme tokens, shadcn primitives, Lucide icons, `useAppForm`, and customer workbench interactions are the visual and behavioral baseline. The map uses distinct Lucide icons for each resource type, visible labels/legend, explicit pending states, confirmations, and non-color-only success/blocker feedback. A synchronized accessible list remains available for keyboard and screen-reader users, the map and sheet fit narrow viewports, and the selection toolbar remains keyboard reachable at 375 px through desktop widths.

**Alternatives considered**: Adopting a new palette, font pairing, or block-heavy visual style from generic dashboard guidance would conflict with the established product system. Relying on color-only map markers would fail accessibility; omitting the synchronized list would make keyboard and screen-reader inspection dependent on map interaction; duplicating a separate mobile interaction model would increase implementation and testing cost without a stated product need.

## Decision: Search and sort the already-fetched named lists in the web adapter

**Rationale**: The existing list endpoints return the complete small reference collections and the customer precedent performs URL-backed filtering and sorting in TanStack Table. Case-insensitive substring search is a presentation requirement, so normalized client-side matching keeps API contracts simple and preserves separate state per resource and availability status.

**Alternatives considered**: Adding server query parameters, pagination, or full-text indexes is not justified by the spec or current reference scale. A single API endpoint returning both resource types would weaken named contracts and cache invalidation.

## Decision: Drive behavior through API and router-level feature tests

**Rationale**: API use-case tests run against the real Lucid repositories on in-memory SQLite and prove conditional writes, version increments, uniqueness, lifecycle state, and mixed outcomes. HTTP integration tests prove authentication, authorization, validation, DTO/error contracts, and endpoint wiring. Web feature tests render the real router/providers and intercept the transport with MSW; they prove independent URL state, forms, permissions, selection, partial success, stale reload prompts, responsive overflow, and accessible controls. Playwright is reserved for a real API/database journey when configured.

**Alternatives considered**: Repository fakes would not prove conditional SQL. Hook/component isolation would couple tests to implementation details. Mocking the Tuyau module would bypass the typed request and error boundary.
