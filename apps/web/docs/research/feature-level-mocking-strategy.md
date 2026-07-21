# Network-mocking strategy for the `apps/web` feature test level

Research ticket, wayfinder #127 follow-up (tracked as issue #130). Investigates what
network-mocking strategy the **feature** test level (one integration-style seam per feature,
rendering through the real TanStack Router + real providers, driving the TDD red-green-refactor
loop) should use. The three-level pyramid (unit / feature / e2e) and the feature level's rendering
environment (jsdom + `@testing-library/react`, Vitest Browser Mode rejected for a confirmed hang on
`.fill()`/`.click()` locator actions) are already decided and out of scope here. This note is
decision *input*, not the decision — see the follow-up ticket for the actual call.

Matches the citation/dating convention of
`docs/research/feature-level-test-framework.md`: all version numbers and doc quotes below
were checked live in July 2026 against the primary source cited (docs site, npm registry, GitHub,
or installed `node_modules` source), not from training-data memory.

## Current state, verified against the repo

Read directly:
- `apps/web/src/test/msw/handlers.ts`, `apps/web/src/test/msw/server.ts`, `apps/web/src/test/setup.ts`
- `apps/web/src/features/auth/__tests__/auth-flow.test.tsx`
- `apps/web/src/libraries/tuyau/client.ts`
- `apps/web/package.json`
- `apps/api/app/exceptions/handler.ts`
- `docs/adr/0005-tuyau-api-web-contract.md`

Findings:

- Stack in `package.json`: `msw@^2.15.0`, `vitest@^4.1.10`, `@testing-library/react@^16.3.2`,
  `@testing-library/user-event@^14.6.1`, `@tuyau/core@^1.2.2`, `@tuyau/react-query@^1.1.0`,
  `react@^19.1.1`.
- `apps/web/src/test/msw/server.ts` is exactly `setupServer(...handlers)` from `msw/node`.
  `setup.ts` wires the canonical lifecycle: `beforeAll(() => server.listen({ onUnhandledRequest:
  'error' }))`, `afterEach(() => { server.resetHandlers(); cleanup() })`, `afterAll(() =>
  server.close())`.
- `apps/web/src/features/auth/__tests__/auth-flow.test.tsx` has 5 tests, two of which (`logs in with valid
  credentials`, `logs out and returns to the login screen`) use a `let isLoggedIn = false`/`true`
  closure variable, flipped by a `server.use(http.post(...))` login/logout handler and read by a
  `server.use(http.get(...))` `/auth/me` handler — a genuine stateful, multi-request-per-test
  scenario, already working today against MSW.
- `apps/api/app/exceptions/handler.ts` confirms the API's real error envelope:
  `ctx.response.status(error.status).send({ error: { code: error.code, message: error.message } })`
  for `Exception` instances, and `{ error: { code, message, details: error.messages } }` for
  `ValidationError`. `apps/web/src/test/msw/handlers.ts` mirrors this shape exactly
  (`{ error: { code: 'E_UNAUTHORIZED_ACCESS', message: '...' } }`), and the success shape used in
  tests (`{ data: { id, email } }`) matches ADR 0005's statement that "API errors exposed to the
  frontend will use a shared shape with `code`, `message`, and optional `details`."
- `apps/web/src/libraries/tuyau/client.ts` instantiates `createTuyau({ baseUrl, registry,
  credentials: 'include' })` from `@tuyau/core/client`, then wraps it with
  `createTuyauReactQueryClient({ client: tuyau })` from `@tuyau/react-query`.
- `node_modules/@tuyau/core/package.json` (installed `1.2.2`) declares
  `"dependencies": { "ky": "^1.14.3", "object-to-formdata": "^4.5.1" }` — confirms Tuyau's transport
  is [`ky`](https://github.com/sindresorhus/ky), a fetch wrapper, not raw `fetch` or axios.
  Installed `ky` resolves to `1.14.3` (`node_modules/.pnpm/ky@1.14.3`).

## 1. MSW (`msw/node`, `setupServer`) — status quo

- **Version / maintenance**: npm registry (`registry.npmjs.org/msw`, checked July 2026): `latest`
  dist-tag is `2.15.0`, published 2026-07-08 — matches what's installed exactly, no version skew.
  GitHub API (`api.github.com/repos/mswjs/msw`, checked July 2026): 18,057 stars, 43 open issues,
  `archived: false`, `pushed_at: 2026-07-10` — actively maintained, last push two days before this
  check.
- **Official recommended Node/jsdom pattern**: MSW's own Node.js integration docs
  (<https://mswjs.io/docs/integrations/node>, checked July 2026) prescribe exactly three lifecycle
  calls — `server.listen()` before tests, `server.resetHandlers()` between tests, `server.close()`
  after tests — with a worked Vitest example using `beforeAll`/`afterEach`/`afterAll`. This is
  **verbatim what `apps/web/src/test/setup.ts` already does.** The docs explicitly frame this as the
  Node-process pattern, distinct from the browser Service Worker (`setupWorker`) mode — irrelevant
  here since Browser Mode was already rejected. MSW's own intro page states it "works with all
  request clients, be it a native `window.fetch()` or third-party libraries" — no client-specific
  integration work needed for `ky`.
- **`server.use()` semantics**: MSW's `setupServer().use()` docs
  (<https://mswjs.io/docs/api/setup-server/use>, checked July 2026): "Prepend request handlers to
  the current server instance," and "the prepended request handlers persist on the server instance
  as long as the current Node.js runtime exists" — i.e. until `resetHandlers()` clears them, exactly
  matching the `afterEach` reset already in place.
- **Stateful multi-request pattern**: not something MSW's docs need to call out specially — MSW
  handlers are plain JS functions passed to `http.get`/`http.post`, so any closure variable
  (`let isLoggedIn = false`) is trivially readable/writable across requests within one test, as
  **already proven working** in `auth-flow.test.tsx` today. No framework-level "state" feature is
  needed or missing.
- **Fidelity**: intercepts at the actual network/`fetch` layer, underneath `ky`. Concretely (read
  from `node_modules/@tuyau/core/build/client/index.js`, `Tuyau#doFetch`, lines ~404–444): Tuyau
  builds a real URL via its route registry, sets real search params, chooses a `json` vs. `body`
  (FormData) request key, calls the real `ky` instance method, content-type-sniffs the real
  `Response` (`application/json` → `.json()`, `application/octet-stream` → `.arrayBuffer()`, else
  `.text()`), and on a `ky` `HTTPError` parses the real response body before wrapping it in
  `TuyauHTTPError`. **All of that code runs for real** against an MSW-mocked network boundary — the
  only thing MSW replaces is what's on the other side of the wire. This means MSW tests genuinely
  exercise Tuyau's URL-building, body-encoding, and error-wrapping logic, not just application code
  that consumes the result. A handler payload shape that drifts from the real API is the only manual
  sync point, and `apps/api/app/exceptions/handler.ts` is a single, small, already-cited source of
  truth to check it against.
- **Setup/maintenance cost**: zero incremental — already built and in use since #115, matches MSW's
  own documented pattern almost line-for-line (no repo-specific deviation to maintain going
  forward).
- **Speed**: per the sibling research note's local measurement, the current 2-file/9-test suite
  (jsdom + MSW) runs in 1.69s wall clock, with jsdom's `environment` boot phase (1.20s) dominating —
  not MSW's interception itself. MSW is not the speed bottleneck at this level; swapping the network
  layer would not measurably change that number.

## 2. Mocking the Tuyau client module directly (`vi.mock('@/libraries/tuyau/client')`)

- **Mechanism**: replace `tuyau`/`tuyauQuery`'s methods with hand-built `vi.fn()`s returning
  constructed response objects, bypassing `ky`/`fetch` entirely.
- **Fidelity risk — confirmed concretely from source, not speculative**: per the `Tuyau#doFetch`
  code cited above, the real client does non-trivial work between "call site" and "response value":
  URL building through `TuyauRouter`, query-param serialization, FormData/body-key branching,
  content-type-based response parsing, and — on errors — unwrapping `ky`'s `HTTPError` into a
  `TuyauHTTPError` that carries the *parsed* response body. AdonisJS's own docs for the client
  (<https://docs.adonisjs.com/guides/frontend/api-client>, checked July 2026, current canonical home
  for Tuyau's docs — `tuyau.julr.dev` 301-redirects there) confirm two call shapes callers must
  handle: throwing by default (`TuyauHTTPError` / `TuyauNetworkError`), or non-throwing via
  `.safe()`, which "returns a tuple where the first element is the data and the second element is
  the error," with the error object exposing a `kind` property and an `isStatus(404)`-style
  narrowing method. A hand-built mock has to reproduce **all** of this by hand, per test, with no
  single source of truth enforcing that the mock's shape still matches what `#doFetch` would
  actually produce. If the API adds a new route, changes an error `code`, or Tuyau itself changes
  how `.safe()`'s error object is shaped in a minor version bump, module mocks keep passing silently
  — they assert against whatever the test author typed, not against anything that ever touched
  `ky`, `fetch`, or a serialized HTTP response. This is the single biggest risk named in the ticket,
  and it is real: nothing in this path re-derives its shape from `apps/api`.
- **Setup/maintenance cost**: grows linearly with API surface. Every new route needs a hand-authored
  mock of the exact call chain (`tuyau.auth.login.$post`, etc.), and every test author needs to know
  that internal chain shape rather than just "what HTTP request would the browser send." No shared
  fixture/envelope-builder exists in the repo today to centralize this, so it would need to be built
  and kept in sync by hand as part of adopting this option.
- **Stateful multi-request pattern**: possible via `vi.fn().mockImplementation(...)` plus a closure
  variable, structurally similar to MSW's `server.use()` — but coupled to Tuyau's *internal* method
  names/call shape rather than to the wire contract, so a refactor of how a component calls Tuyau
  (e.g. switching from `.safe()` to try/catch, or from one query key to another) can break the mock
  without any change in real API behavior.
- **Speed**: fastest in theory (no URL building, no body serialization, no `Response` construction),
  but per the framework research note the jsdom `environment` boot phase dominates suite time
  (1.20s of 1.69s), so the realistic delta versus MSW is negligible at this level.

## 3. Hand-rolled fetch/ky mock (`vi.stubGlobal('fetch', ...)` or a custom `fetch` passed to `ky`)

- **Confirmed Tuyau is built on `ky`**: see current-state section above (`@tuyau/core`'s own
  `package.json` dependency on `ky@^1.14.3`).
- **Ky's own README** (`raw.githubusercontent.com/sindresorhus/ky/main/readme.md`, checked July
  2026) documents exactly two testing approaches, in this order: "Use MSW to intercept requests at
  the network level without modifying your code," or, "Alternatively, pass a custom `fetch` to your
  Ky instance," e.g. `ky.create({ fetch: async () => new Response(...) })`. **Ky's own maintainer
  documentation recommends MSW first**, and frames the custom-`fetch` option as the alternative for
  cases needing "custom instrumentation," logging, or SSR-framework fetch wrappers — not
  specifically as a testing best practice.
- **Whether `vi.stubGlobal('fetch', ...)` would actually work here — checked directly against the
  installed `ky@1.14.3` source**, not assumed: `node_modules/.pnpm/ky@1.14.3/node_modules/ky/distribution/core/Ky.js`,
  constructor, line 154: `fetch: options.fetch ?? globalThis.fetch.bind(globalThis)`. Critically,
  this resolves inside the `Ky` **constructor**, and `distribution/index.js` shows `ky.get()` /
  `ky.post()` call `Ky.create(input, validateAndMerge(defaults, options, { method }))`, where
  `Ky.create` is `new Ky(input, options)` — i.e. **a new `Ky` instance, and therefore a fresh read of
  `globalThis.fetch`, is created on every actual request**, not once when Tuyau's client module is
  first imported. This means a global `fetch` stub set in test setup (any time before the request
  fires, even after module load) would in fact be picked up — a real, working option in this exact
  installed version, contrary to the general caution (raised in `sindresorhus/ky` issue discussions
  about tools like Pretender capturing a stale `fetch` reference) that this pattern is sometimes
  unreliable. That caution does not apply to this repo's installed `ky` architecture.
- Separately, `@tuyau/core/build/client/index.js` (`#mergeKyConfiguration`, line ~321) spreads
  `...this.#config` directly into the object passed to `ky.create()`, so `createTuyau({ ..., fetch:
  customFetchFn })` would also work as a per-client custom-fetch override — an **undocumented but
  source-confirmed** capability of Tuyau's config surface (not mentioned in AdonisJS's Tuyau docs
  page), since it's just an unfiltered spread, not a designed option.
- **Fidelity risk**: even though the interception point technically works, a hand-rolled mock only
  ever sees a raw `Request` and must construct a raw `Response` by hand — meaning the test author
  would be re-implementing MSW's declarative method/path routing and JSON `Response` construction
  from scratch, by hand, per handler, with no shared library doing status-code/header/body
  bookkeeping. It also has to stay correct against whatever exact `Request` `ky` produces (query
  string building, retry wrapping, timeout handling, `prefixUrl` joining) since none of that is
  mocked away — a strictly harder, more error-prone version of what MSW already gives for free.
  There is no incremental fidelity gain over MSW (both sit at the network boundary; MSW is just the
  batteries-included version of the same idea) and a real ergonomic and maintenance cost.
- **Setup/maintenance cost**: higher than MSW for equivalent coverage — no `http.get(url, handler)`
  ergonomics, no automatic per-URL routing, no built-in `onUnhandledRequest` guard rail (already
  relied on in `setup.ts` today to catch untested/typo'd routes).
- **Stateful multi-request pattern**: possible (closures work the same way against a hand-rolled
  mock function), but every handler needs its own manual method/URL branching logic that MSW's
  `http.get`/`http.post` already provides.

## 4. Tuyau's own documented/official testing guidance — checked directly

- Tuyau's GitHub README (`raw.githubusercontent.com/Julien-R44/tuyau/main/README.md`, checked July
  2026): no section on testing, mocking, or MSW integration.
- Tuyau's docs (canonical URL now folded into AdonisJS's own docs site;
  `tuyau.julr.dev/docs/introduction` 301-redirects to
  `docs.adonisjs.com/guides/frontend/api-client`, checked July 2026): covers installation,
  configuration (`baseUrl`, `registry`, `headers`, `hooks`), making calls, `.safe()` error handling,
  file uploads, URL generation, and the `beforeRequest`/`afterResponse`/`beforeError` hook surface —
  **no testing or mocking section anywhere on this page.**
- npm registry search for `tuyau` (`registry.npmjs.org/-/v1/search?text=tuyau`, checked July 2026):
  enumerates the full package family (`@tuyau/core`, `@tuyau/react-query`, `@tuyau/vue-query`,
  `@tuyau/openapi`, `@tuyau/codegen`, community forks) — **no dedicated testing/mocking package**
  (e.g. no `@tuyau/msw`, no mock-registry generator) exists.
- **Conclusion**: Tuyau does not document or ship an official testing/mocking approach for
  `createTuyau` clients. The only first-party signal at all is one level down the stack — `ky`'s own
  README recommending MSW first, as cited in option 3 above. There is no primary source anywhere
  that recommends mocking the Tuyau client module itself; that pattern is not blessed by Tuyau, by
  `ky`, or by AdonisJS's docs.

## Other candidates considered and set aside

- **MSW's legacy `rest` API vs. `http`/`graphql`**: not a live choice — `apps/web/src/test/msw/handlers.ts`
  already uses the current `http`/`HttpResponse` API (`msw` v2's default since its 2023 major
  rewrite), and the installed `2.15.0` no longer ships `rest` as the documented entry point. Nothing
  to migrate or decide here.
- **A mock server generated from the Tuyau registry** (e.g. auto-deriving MSW handlers from
  `@portflow/api/registry`'s route/DTO types): no such generator exists in Tuyau's package family
  (checked in the npm search above) or in this repo. Building one is a plausible future investment
  once the API surface grows well past auth, but it is net-new infrastructure with no primary-source
  precedent to build from today — out of scope for this decision, which is choosing among existing,
  documented tools.
- **Contract testing (e.g. Pact-style consumer/provider contracts)**: `pact-msw-adapter` exists
  upstream (found during the npm search above) and generates Pact contracts *from* MSW-recorded
  interactions rather than replacing MSW — it would sit on top of the MSW option, not compete with
  it, and this repo has no stated need for cross-team contract verification (single monorepo, one
  frontend, one backend). Not evaluated further as a distinct option for that reason.

---

## Recommendation

**Keep MSW (`msw/node`'s `setupServer`) as the feature level's network-mocking strategy.** Formally
ratify the pattern already built during #115 rather than replacing it.

Stated plainly, the deciding factors:

1. **Fidelity is the dominant criterion here, and MSW wins it outright.** MSW intercepts at the
   actual network boundary, underneath `ky`, so every test genuinely exercises Tuyau's real
   `#doFetch` code path — URL building, query serialization, body-key branching, content-type
   sniffing, and `TuyauHTTPError`/`TuyauNetworkError` wrapping — confirmed line-by-line against the
   installed `@tuyau/core` source above. Both alternative options bypass some or all of that: module
   mocking bypasses it entirely and hand-authors Tuyau's own output shape (including its
   `.safe()`/error-`kind` contract) with nothing keeping it in sync with reality; a hand-rolled fetch
   mock keeps the same interception point as MSW but forces the test author to re-implement MSW's
   routing/response-construction by hand, for no fidelity gain.
2. **No option here is faster in any way that matters.** The jsdom environment-boot phase, not the
   network-mocking layer, dominates this suite's wall-clock time (1.20s of 1.69s, per the sibling
   framework research note). Any speed argument for module-mocking or hand-rolled fetch mocks is
   theoretical and not supported by where this repo's time is actually going.
3. **Setup/maintenance cost favors MSW by a wide and widening margin.** It is already built,
   already matches MSW's own documented Node.js pattern nearly verbatim, and already proves out the
   stateful multi-request pattern the auth-flow suite needs (`let isLoggedIn = false`, flipped by one
   handler, read by another) with plain JS closures — no framework feature needed. The two
   alternatives both require hand-built infrastructure (a mock-response builder matching Tuyau's
   real output shape, or a hand-rolled request router) that would need to be built now and
   maintained forever as the API grows past auth, with module-mocking specifically carrying
   compounding drift risk as more routes and error `code`s are added with nothing to catch a mock
   that stops matching reality.
4. **No primary source recommends an alternative.** Tuyau's own docs and README are silent on
   testing entirely. The one first-party signal that exists — `ky`'s own README — explicitly lists
   MSW first, ahead of its own custom-`fetch` escape hatch. There is no primary source anywhere
   recommending module-level mocking of a Tuyau (or `ky`) client for tests.

**What would change this recommendation**: if a future ticket needs to simulate transport-level
failures MSW cannot express cleanly (e.g. a genuinely offline `fetch` rejection distinct from an
HTTP error status, to exercise `TuyauNetworkError` specifically) — MSW's own "Network errors" docs
(<https://mswjs.io/docs/http/mocking-responses/network-errors/>, checked July 2026) document exactly
this: a handler can `return HttpResponse.error()` to abort the request as a network error (note:
neither `HttpResponse.error()` nor the underlying `Response.error()` support a custom error message,
by Fetch API design). Check that path first before reaching for `vi.stubGlobal('fetch', ...)` as a
narrow, test-local escape hatch alongside MSW, not as a replacement for it.
