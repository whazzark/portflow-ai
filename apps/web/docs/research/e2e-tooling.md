# E2E tooling options for `apps/web`

Research ticket, wayfinder #127 follow-up (tracked as issue #131). Investigates which **e2e**
tooling `apps/web` should use — Playwright Test, Cypress, and any TanStack-Start-specific
first-party guidance. The e2e test level's shape is already locked by issue #127's "Decisions so
far" (ticket #128, "Test pyramid shape and philosophy for apps/web"): a **comprehensive** suite of
full user journeys — not a handful of smoke tests — run against a **real** `apps/api` instance and
a **real** database (never mocked/MSW), **intended to run in CI on every relevant trigger**,
written after a feature is green as a safety net rather than TDD'd behavior-by-behavior. That shape
is out of scope here; this note sizes tooling options *against* it, not against a toy suite. This
note is decision *input*, not the decision — see the closing section for the follow-up ticket that
makes the actual call.

Matches the citation/dating convention of `docs/research/feature-level-test-framework.md`
and `docs/research/feature-level-mocking-strategy.md`: all facts, quotes, and version
numbers below were checked live in July 2026 against the primary source cited (docs site, npm
registry, GitHub API, or GitHub source) — not from training-data memory. One exception is flagged
inline where a tool-call budget limit was hit mid-session before a claim could be verified against
its primary doc page directly; that claim is marked as unverified rather than presented as checked.

## Current state, verified against the repo

- `apps/web/package.json`: no e2e tooling installed today. `devDependencies` are only
  `@testing-library/jest-dom`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`,
  `msw`, `vitest` — a feature-level stack only. `dependencies` include
  `@tanstack/react-start: ^1.168.27`, `@tanstack/react-router: ^1.170.17`, `react: ^19.1.1`,
  `vite: ^7.1.10`.
- `apps/web/vite.config.ts` wires the `tanstackStart()` Vite plugin from
  `@tanstack/react-start/plugin/vite`.
- `apps/api/package.json` does not list `@japa/browser-client` as a direct devDependency, but
  `pnpm-lock.yaml` shows `playwright@1.61.1` and `playwright-core@1.61.1` present transitively —
  pulled in via `@adonisjs/session`'s optional peer chain through `@japa/plugin-adonisjs` →
  `@japa/browser-client` (confirmed by grepping `pnpm-lock.yaml` for `browser-client`). This is a
  transitive artifact only, not something `apps/api` actively uses for its own tests today.
- This machine already has Playwright's Chromium binaries cached (`chromium-1228`,
  `chromium_headless_shell-1228`, `ffmpeg-1011` under `~/Library/Caches/ms-playwright`) — no
  Firefox or WebKit binaries present.
- `apps/api` uses AdonisJS session-cookie auth (`@adonisjs/session`), not bearer tokens — see the
  recent commits "Expose session restoration and logout endpoints" and "Restrict login to active
  users." This is the auth shape every e2e journey will need to carry across steps.
- Newly verified for this ticket: grepped `apps/web/src` for `createServerFn` — zero matches.
  `apps/web` does not currently use TanStack Start's own server-function RPC mechanism; per the
  sibling mocking-strategy research note, it talks to `apps/api` exclusively through the Tuyau
  client. The "server functions over real HTTP" consideration below is therefore forward-looking
  for this repo, not a fact about today's app.
- npm registry, checked live July 2026: `@playwright/test`'s `latest` dist-tag is `1.61.1` —
  **exactly** the version already present transitively in this repo's `pnpm-lock.yaml` (see
  above), so adding it as a direct devDependency today carries zero version-skew risk. `cypress`'s
  `latest` dist-tag is `15.18.1` — a net-new tool, absent anywhere in the repo's current dependency
  graph.
- GitHub API, checked live July 2026 (mirroring the maintenance-signal check the sibling
  mocking-strategy note ran for `msw`): `microsoft/playwright` — 92,749 stars, 170 open issues,
  `archived: false`, `pushed_at: 2026-07-13` (same day as this check). `cypress-io/cypress` —
  50,677 stars, 1,103 open issues, `archived: false`, `pushed_at: 2026-07-13`. Both actively
  maintained by this signal, at comparable recency.

## 1. Playwright Test (`@playwright/test`)

**Setup cost**: `npm init playwright@latest` (<https://playwright.dev/docs/intro>, checked July
2026) scaffolds `playwright.config.ts`, a `tests/example.spec.ts` starter file, and updates
`package.json`; the init prompt also offers to install browsers and a GitHub Actions workflow. It
ships as one integrated package — "test runner, assertions, isolation, parallelization and rich
tooling" per its own docs — so `npx playwright test` *is* the runner; there is no separate
test-runner process to wire up on top of Vitest, and no GUI is required to run it.

**Dev/build pipeline interaction**: the `webServer` config block
(<https://playwright.dev/docs/test-webserver>, checked July 2026) takes `command` + `url` +
`reuseExistingServer` (conventionally `!process.env.CI`) + `timeout` (default 60s) +
`cwd`/`env`/`stdout`/`stderr`, and Playwright waits for `url` to return a 2xx/3xx/4xx response
before running tests. Critically, the docs confirm `webServer` **accepts an array of entries**,
documented explicitly as the way to boot "both frontend and backend services simultaneously," each
with its own `command`/`url`/`name` — this maps directly onto this repo's need (one entry boots
`apps/api` against a real Postgres, one boots `apps/web`, both torn down when the run ends).
Beyond `webServer`, `globalSetup`/`globalTeardown`
(<https://playwright.dev/docs/test-global-setup-teardown>, checked July 2026) run once before/after
the whole suite and can shell out to any process — e.g. provisioning or dropping a database — but
the docs flag real limitations versus the newer "project dependencies" pattern: no HTML report
visibility, no trace recording, no fixture support, and config options like `headless` are ignored.
TanStack's own `basic-auth` e2e example (see the TanStack section below) uses a dependency "setup"
test project instead of `globalSetup` for per-run DB prep, which is the currently-favored pattern
in Playwright's own docs. Net: Playwright has three composable, built-in levers (multi-entry
`webServer` for process lifecycle, `globalSetup`/`globalTeardown` or a dependency setup project for
data lifecycle) that together cover "start two real services and reset a real database" without
external glue scripts.

**Auth/session-state reuse**: `storageState`
(<https://playwright.dev/docs/auth>, checked July 2026) serializes cookies, `localStorage`, and
IndexedDB via `context.storageState({ path })`; consuming projects declare
`storageState: 'playwright/.auth/user.json'` and a `dependencies` entry on a `setup` project that
logs in once. The docs list cookies as the first-named storage mechanism with no cookie-vs-token
distinction drawn, so `apps/api`'s `@adonisjs/session` cookie should round-trip cleanly through this
mechanism. Friction points Playwright's own docs call out: the stored state file must be deleted
and regenerated once it expires (no auto-refresh), it must be gitignored (it holds live session
cookies), and Playwright's UI mode skips the setup project by default, so a stale cached session
needs manual local re-authentication. `sessionStorage` specifically is called out as not
persisted (origin+tab-scoped by spec) — irrelevant here since this repo's auth is cookie-only, per
the sibling research notes.

**Browser-binary requirements**: `npx playwright install`
(<https://playwright.dev/docs/browsers>, checked July 2026) fetches per-browser binaries
(chromium/firefox/webkit) from Microsoft's CDN into an OS-specific cache dir —
`~/Library/Caches/ms-playwright` on macOS, ~180–280MB per browser — matching the versioned
`chromium-1228`/`chromium_headless_shell-1228`/`ffmpeg-1011` directories already confirmed cached on
this machine (Chromium only, no Firefox/WebKit). A CI config that only requests the `chromium`
project — as TanStack's own `basic-auth` example does (`projects: [{ name: 'chromium', ... }]`) —
means the install step downloads one browser, not three; first CI run cost stays proportional to
the projects actually configured.

**SSR/TanStack-Start-specific gotchas**: hydration timing is a real, documented risk, not
theoretical. Playwright's own issue tracker (`microsoft/playwright#27759`, checked July 2026)
describes exactly this failure mode: "a very fast user" (Playwright) can click a button before its
event handler is bound during hydration, and the click is delivered but has no effect. The
maintainers' stated fix in that thread is app-side (disable interactive controls until hydrated
completes), not a Playwright flag; test-side mitigations (wait for a hydration-complete
selector/class, or pair `waitForResponse` with the interaction) are documented community patterns,
not a first-party API. For a TanStack Start root document shell specifically, this should be
designed for (a hydration-ready marker) rather than assumed away. Separately, TanStack Start's
build replaces `createServerFn` implementations with client-side RPC stubs that make real HTTP
requests to server endpoints (per TanStack/router's own docs and community discussion, checked July
2026) — so a Playwright test driving a real browser against a real running server genuinely
exercises that RPC path end to end. As noted above, this is forward-looking for `apps/web` today
(zero `createServerFn` usage currently; all backend calls go through the Tuyau client to `apps/api`).

**Speed/CI-scale characteristics**: parallelism is two-layered
(<https://playwright.dev/docs/test-sharding>, checked July 2026) — in-machine worker parallelism
across CPU cores by default, plus `--shard=x/y` to split across multiple CI machines/jobs (the docs'
own example: four shards run "four times faster"), with a blob reporter and
`npx playwright merge-reports` to recombine results afterward. `fullyParallel: true` splits at the
individual-test level for even shard balancing; without it, shards balance at the file level and
the docs recommend keeping files "small and evenly sized." This is the lever a comprehensive,
growing full-journey suite would lean on to keep CI wall-clock flat as the suite grows — a built-in,
no-account CLI flag, not something bolted on later.

## 2. Cypress

**Setup cost**: `npm install cypress --save-dev` then `npx cypress open`
(<https://docs.cypress.io/app/get-started/install-cypress>, checked July 2026): the first run is
**GUI-driven** — it launches the Cypress App, where you choose E2E vs. component testing before
Cypress scaffolds `cypress.config.ts` and a `cypress/` folder (fixtures/support/e2e). This is a real
difference from Playwright's single CLI-driven init: Cypress's first-run config-authoring
experience is an interactive desktop app, not a headless scaffold command. CI runs use
`npx cypress run` instead of `open`, but the initial config is documented as GUI-first.

**Dev/build pipeline interaction**: `cypress.config.ts`'s `baseUrl`
(<https://docs.cypress.io/app/references/configuration>, checked July 2026) is used only as a
prefix for `cy.visit()`/`cy.request()` — Cypress **explicitly does not boot the app under test
itself**. Booting and tearing down both `apps/web` and a real `apps/api` + database is left entirely
to whatever wraps the `cypress run` invocation; there is no config-level equivalent to Playwright's
`webServer` array. The documented community-standard tool for this gap is `start-server-and-test`
(<https://www.npmjs.com/package/start-server-and-test>, checked July 2026): "starts your server,
waits until a URL responds, runs your test command, and shuts the server down when the tests
finish" — but this is a separate, third-party package layered on top of `package.json` scripts, not
a Cypress feature, and it's built around one server/one URL, not natively around "boot two
independent services and wait on both." Cypress's own `setupNodeEvents`
(<https://docs.cypress.io/api/node-events/overview>, checked July 2026) exposes `before:run`/
`after:run` (whole-run) and `before:spec`/`after:spec` (per-file) hooks plus `cy.task()` for
arbitrary Node code, explicitly documented as usable for "manipulating a database (seeding, reading,
writing, etc.)" and "running an external process." So database seed/reset logic has a first-party
home in Cypress; full second-process orchestration (starting/stopping `apps/api` itself) does not —
it would be hand-rolled `child_process` code inside `before:run`/`after:run`, with no Cypress-native
pattern comparable to Playwright's `webServer`.

**Auth/session-state reuse**: `cy.session()`
(<https://docs.cypress.io/api/commands/session>, checked July 2026) caches cookies, `localStorage`,
and `sessionStorage` keyed by an `id`, running its setup callback only on first use or after failed
re-validation, with an optional `validate()` re-checked on restore. The documented example pattern
is literally an API login that sets cookies — first-party support for cookie-based session auth,
same as Playwright's `storageState`. Friction points Cypress's own docs call out: sessions are
cached only for the duration of one spec file by default (`cacheAcrossSpecs: true` exists but
requires an identical `id`/`setup`/`validate`/options everywhere it's used, or it throws);
`testIsolation` behavior requires an explicit `cy.visit()` after `cy.session()` or the test runs on
a blank page; and `cy.session()` yields `null`, which breaks any existing helper that expected a
response object back from a login call. Separately, Cypress enforces same-origin (scheme+host+port)
for all commands within a single test by default
(<https://docs.cypress.io/app/guides/cross-origin-testing>, checked July 2026); a real
server-driven redirect (e.g. a full-page login POST that 302s to a different origin) requires
wrapping the post-redirect commands in `cy.origin()`. `apps/api`'s session-cookie login is same-origin
relative to `apps/web` in this repo's architecture, so `cy.origin()` is likely avoidable here, but
it's a real constraint to verify once the actual login redirect flow is built — the kind of gotcha
that surfaces only once a full journey is chained through a real redirect, not in an isolated test.

**Browser-binary requirements**: Cypress bundles **Electron only**
(<https://docs.cypress.io/app/references/launching-browsers>, checked July 2026) — "requires no
separate installation and is always available." Chrome, Edge, and Firefox are auto-detected but
must already be installed on the machine (Cypress does not fetch them); Firefox additionally needs
the `geckodriver` npm wrapper, which Cypress auto-downloads; WebKit is experimental and requires the
`playwright-webkit` npm package plus `playwright install-deps webkit` on Linux. Net: a fresh CI
machine gets a working browser (Electron) with zero extra install step — a lighter first-run bar
than Playwright's per-browser CDN download — but Electron is the only browser that "just works" out
of the box; testing in actual Chrome/Firefox on CI means the CI image must separately provide those
browsers, which is exactly the kind of setup Playwright's own install step automates instead.

**SSR/TanStack-Start-specific gotchas**: no TanStack-specific guidance exists — neither TanStack's
docs nor its examples repo (see next section) reference Cypress anywhere; Playwright is the only
e2e tool TanStack itself dogfoods or documents. On generic SSR/hydration: web search surfaced a
claim (via third-party blog summaries, not confirmed directly against a `docs.cypress.io` page in
this session — flagged per the note at the top, a tool-call budget limit was hit before this could
be verified against its primary source) that Cypress injects a bootstrap script into `<head>` before
React hydration runs, which can itself trigger a hydration mismatch on SSR apps, and that Cypress
documents a `data-cy-bootstrap` marker script to control the injection point as a workaround. **This
claim should be treated as unverified** until someone confirms it directly against Cypress's own
docs — it is exactly the kind of SSR-specific gotcha this ticket is meant to surface, so it is worth
running down explicitly in the follow-up decision ticket rather than dropping silently, but it does
not meet this note's own bar for a checked primary-source fact. What *is* independently confirmed:
Next.js's own official Cypress guide
(<https://nextjs.org/docs/pages/guides/testing/cypress>, checked July 2026, cited via search
results) recommends building and starting the app first (`next build && next start`) then running
Cypress against the running production server — the same "build once, serve once, drive it" shape
as a `webServer` entry, just orchestrated by hand rather than by a Cypress config primitive.

**Speed/CI-scale characteristics**: parallelization across CI machines is file-based and, in
Cypress's own first-party workflow, gated behind Cypress Cloud
(<https://docs.cypress.io/cloud/features/smart-orchestration/parallelization>, checked July 2026):
passing `--parallel` requires `--record`, i.e. an account with Cypress's hosted
dashboard/orchestrator to decide which spec file runs on which machine. Open-source alternatives
exist to avoid that dependency — e.g. the third-party plugin `cypress-split`
(<https://www.npmjs.com/package/cypress-split>, checked July 2026) or a self-hosted orchestrator
(`sorry-cypress`) — but no-account, native CI parallelization is not something Cypress ships out of
the box the way Playwright's `--shard` flag is. For a "comprehensive suite of full journeys intended
to run in CI on every trigger" — the explicit ambition locked by #128 — this is a material
difference: Playwright's sharding lever is free and built-in; Cypress's equivalent either costs a
Cypress Cloud plan or requires adopting a third-party plugin to replicate what Playwright does
natively.

## TanStack Start-specific first-party guidance

- TanStack Router's own "Set Up Testing" how-to doc
  (<https://tanstack.com/router/latest/docs/framework/react/how-to/setup-testing>, checked July
  2026) has a section titled "E2E Testing with Playwright" with a sample `playwright.config.ts` and
  an example `navigation.spec.ts` covering page navigation, search params, and a login flow. It does
  **not** mention TanStack Start specifically, SSR, hydration, or server functions, and gives no
  session-state/`storageState` guidance — the auth example shown is a bare login-then-visit a
  protected route, with no persisted session reused across tests.
- TanStack/router's own examples monorepo (<https://github.com/TanStack/router>, checked July 2026)
  ships dedicated Start example apps under `e2e/react-start/*` — `basic`, `basic-auth`,
  `basic-react-query`, `rsc`, `server-functions`, `streaming-ssr`, and roughly 30 more. Every one of
  them tests exclusively via `@playwright/test`; no Vitest/jsdom/Testing Library and no Cypress
  anywhere in that tree (already noted in the sibling framework research note; re-confirmed here
  directly against `e2e/react-start/basic-auth/package.json`, whose only test dependency is
  `@playwright/test@1.50.1`, scripted as `playwright test --project=chromium`). Playwright is the
  only e2e tool TanStack itself dogfoods for Start apps.
- The `basic-auth` example's own `playwright.config.ts`
  (`raw.githubusercontent.com/TanStack/router/main/e2e/react-start/basic-auth/playwright.config.ts`,
  checked July 2026) uses a **single** `webServer` entry (`pnpm build && pnpm start`, url from a
  shared `getTestServerPort()` helper, `reuseExistingServer: !process.env.CI`) and a single
  `chromium` project — TanStack's own dogfooding doesn't demonstrate the multi-`webServer` or
  `storageState`/setup-project patterns this repo's ambition needs; it's a simpler, single-process,
  single-service example than what a real-`apps/api`-plus-real-Postgres suite would require.
- It does demonstrate the project-dependency "setup" pattern for database lifecycle:
  `tests/mock-db-setup.test.ts` is a Playwright setup project
  (`import { test as setup } from '@playwright/test'`) that uses Prisma directly to delete a
  leftover test user before the real suite runs, with a matching `mock-db-teardown.test.ts`. This is
  a real, working, primary-source example of exactly the "orchestrate a real DB via Playwright's own
  project-dependency mechanism" pattern this ticket's parent decision cares about — though it resets
  one row via an ORM client in-process, not "start/stop a whole second service," so it's a
  smaller-scale precedent than this repo's real-`apps/api`-plus-real-Postgres ambition would need.
- Auth/session handling in that same example (`tests/app.spec.ts`, checked July 2026): every test
  logs in through the UI form directly; there is no `storageState`, no `cy.session()`-equivalent,
  and no persisted-session reuse across tests anywhere in TanStack's own example. This is a real gap
  in TanStack's own dogfooding relative to what a comprehensive, many-journeys suite would want
  (re-logging in through the UI on every single test is a cost a large suite can't absorb) — the
  `storageState` mechanism documented on playwright.dev (see the Playwright section above) is the
  answer, but TanStack's own examples don't showcase it, so it's a plain Playwright capability this
  repo would need to adopt independently, not a TanStack-blessed pattern.
- No TanStack Start-specific e2e guidance beyond the shared Router how-to doc and the examples repo
  was found — no dedicated "Testing Start apps" page, and no first-party guidance on hydration
  timing, SSR document-shell testing, or server-function RPC testing exists on tanstack.com (checked
  July 2026).

---

## Recommendation

Weighed against the locked ambition specifically — comprehensive full-journey suite, real API + real
database, intended to run in CI on every relevant trigger — **Playwright Test is the stronger fit of
the two tools surveyed**, for reasons specific to that ambition rather than general tool preference:

1. **Process orchestration is native, not bolted on.** Playwright's `webServer` config accepts
   multiple entries out of the box — documented explicitly for booting frontend and backend
   services together — which maps directly onto "boot `apps/web` and `apps/api`, both against a
   real database, then tear both down." Cypress has no config-level equivalent; the community answer
   is a third-party package (`start-server-and-test`) built around one server, not two.
2. **Database lifecycle has a working, primary-source precedent inside Playwright's own project-
   dependency mechanism** — TanStack's own `basic-auth` example (`mock-db-setup.test.ts`/
   `mock-db-teardown.test.ts`) demonstrates it directly, even if at smaller scale than this repo
   would need. Cypress's `setupNodeEvents` also documents DB-seeding support via `before:run`/
   `after:run`/`task`, so this is not a blocking gap for Cypress, but Playwright's version already
   has a real worked example to build from.
3. **CI-scale parallelism is free and built-in for Playwright** (`--shard`), while Cypress's
   equivalent either requires a Cypress Cloud account or a third-party plugin. For a suite explicitly
   meant to be comprehensive and to run on every relevant CI trigger, this is a real, not
   theoretical, cost difference as the suite grows.
4. **Auth/session reuse (`storageState` vs. `cy.session()`) is a wash** — both are documented,
   first-party, and confirmed compatible with cookie-based session auth; neither has a
   disqualifying gap for this repo's `@adonisjs/session` cookie model.
5. **TanStack itself dogfoods only Playwright** for Start apps, across ~30+ example apps in its own
   monorepo; no primary source anywhere recommends Cypress for a TanStack Start app specifically.
6. **Zero version-skew cost**: `@playwright/test`'s current `latest` (`1.61.1`) already exists
   transitively in this repo's `pnpm-lock.yaml`, and Chromium binaries are already cached on this
   machine — the lowest-friction adoption path of the two tools, mechanically.

Genuine points in Cypress's favor that a decision-maker should still weigh: `cy.session()` reads as
somewhat more ergonomic than Playwright's file-based `storageState` + dependency-project pattern for
a team unfamiliar with either, and Cypress's bundled Electron browser means zero first-run
browser-install step (versus Playwright's per-browser CDN download, already mitigated here by the
cached Chromium binaries). Neither point offsets the process-orchestration and CI-parallelism gaps
above, given the specific "comprehensive, real-API, real-DB, CI-on-every-trigger" ambition this
ticket was scoped against — a smaller or slower-scaling suite might weigh these tradeoffs
differently.

**This note is decision input only.** The actual e2e tooling and CI-approach choice belongs to a
separate, still-blocked follow-up ticket, gated on both this research note (issue #131) and the
not-yet-resolved CI-constraints research ticket (issue #132).
