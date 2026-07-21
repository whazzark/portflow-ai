# Feature-level test framework for `apps/web`

Research ticket, wayfinder #128-follow-up. Investigates what the **feature** test level (one
integration-style seam per feature, rendering through the real router + real providers, driving
the TDD red-green-refactor loop) should use for its test framework and rendering approach. The
three-level pyramid shape (unit / feature / e2e) is already decided and out of scope here; e2e is
already locked to Playwright against a real `apps/api`. This note is decision *input*, not the
decision — see the follow-up ticket for the actual call.

Convention note: there is no existing `docs/research/` (or similar) convention in this repo —
checked `docs/` and `docs/adr/`, which hold only ADRs and agent-workflow docs
(`docs/agents/*.md`). This file establishes `docs/research/` as a plain, dated, primary-source-cited
research-notes location; nothing here overrides ADR process.

All version numbers below were checked live in July 2026 against the primary source cited (docs
site, npm registry, or GitHub), not from training-data memory.

## Current state, verified against the repo

Read directly (all under `apps/web/`):
`vitest.config.ts`, `src/test/setup.ts`, `src/test/msw/{handlers,server}.ts`,
`src/test/render-app.tsx`, `src/features/auth/__tests__/auth-flow.test.tsx`,
`src/libraries/tuyau/api-error.test.ts`, `src/routes/__root.tsx`, `package.json`.

- Stack: Vitest `4.1.10`, `jsdom` `29.1.1`, `@testing-library/react` `16.3.2`,
  `@testing-library/user-event` `14.6.1`, MSW `2.15.0`, React `19.1.1`,
  `@tanstack/react-router` `1.170.17`, `@tanstack/react-start` `1.168.27`.
- `vitest.config.ts` loads the `tanstackStart()` Vite plugin so `routeTree.gen.ts` regenerates on
  a clean checkout, plus `@vitejs/plugin-react`, `environment: 'jsdom'`.
- The one feature-level seam (`auth-flow.test.tsx`) renders `<RouterProvider>` from a real
  `createRouter({ routeTree, context: { queryClient }, history: createMemoryHistory(...) })`,
  through `render-app.tsx`, with MSW intercepting `fetch` at the network layer. This exercises the
  *real* root route, which renders a full `<html><head>...</head><body>...</body></html>` document
  (`src/routes/__root.tsx`).

**Correction to the ticket's premise, empirically checked, not assumed:** I ran `pnpm test` in
`apps/web` against the exact current dependency versions above (`pnpm test` → `vitest run`,
captured full stdout/stderr, grepped for `html|hydration|cannot be a child`). **The
`` `<html>` cannot be a child of `<div>` `` console warning does not reproduce** in this repo state
today. The only console noise is `Not implemented: Window's scrollTo() method` (jsdom's known
navigation/layout gap, see jsdom section below).

The likely reason, read directly from the installed `react-dom` `19.1.1` source
(`node_modules/react-dom/cjs/react-dom-client.development.js`, function
`resolveSingletonInstance`, ~line 22590): React 19 treats `<html>`, `<head>`, and `<body>` as
**host singletons**. When React encounters one of these tags anywhere in the tree, it resolves the
fiber to the *actual* `document.documentElement` / `document.head` / `document.body` of whatever
document it's rendering into, rather than inserting a literal new DOM node as a child of the
render container. This is a React 19 DOM-client behavior, not a Testing Library or jsdom feature —
it would apply the same way in any jsdom-based renderer. It doesn't fully close the fidelity gap
between jsdom and a real browser (see jsdom section), but it does mean the specific
"`<html>`-in-`<div>`" artifact the ticket flagged as confirmed noise is **not currently reproducible
with these exact versions**, so it should not be weighted as a live argument against jsdom in the
final decision. (It may have been observed on an earlier dependency combination during #115; it is
not present now.)

Also measured (not a controlled benchmark, but real, from this repo, unmodified): the full 2-file,
9-test suite (one plain unit file, one router+MSW feature file) ran in **1.69s wall clock**
(`transform 232ms, setup 603ms, import 279ms, tests 419ms, environment 1.20s` — Vitest's own
phase breakdown; phases overlap so they don't sum to the total). The `environment` phase (jsdom
boot) is the single largest line item, which matters for the speed-vs-fidelity argument below.

I did not run a live head-to-head benchmark of the same suite under Vitest Browser Mode: Playwright
browser binaries are cached locally from unrelated prior work, but `apps/web`'s `package.json` and
the repo's `pnpm-lock.yaml` currently carry unrelated uncommitted changes from other in-progress
work in this checkout, so adding/removing a devDependency to run the experiment and reverting via
`git checkout` was not safe to do without risking someone else's uncommitted work. The speed
figures for Browser Mode below are therefore vendor-documented, not locally measured — flagged
explicitly per candidate.

---

## 1. Vitest + `@testing-library/react` + jsdom (status quo)

- jsdom's own README, "Unimplemented parts of the web platform"
  (<https://github.com/jsdom/jsdom#readme>, checked July 2026): jsdom explicitly documents two
  structural gaps — **navigation** (changing `location.href` or clicking a link does not create a
  new Window/Document; it logs a `jsdomError` to the virtual console instead) and **layout**
  (jsdom "does not have the capability to render visual content"; `getBoundingClientRect()`,
  `offsetTop`, etc. return zeroed dummy values because there is no real layout engine). jsdom
  states plainly that it is a simulation, not a browser.
- Vitest's own "Why Browser Mode" guide (<https://vitest.dev/guide/browser/why>, docs version
  v4.1.9, checked July 2026) frames this as the reason Browser Mode exists at all: "[jsdom/happy-dom]
  only simulate a browser environment and not an actual browser, which may result in some
  discrepancies between the simulated environment and the real environment," which "may result in
  false positive or false negative test results."
- Confirmed locally (above): with current versions, jsdom **does** successfully mount the full
  `<html>/<head>/<body>` SSR document shell from `__root.tsx` without the specific nesting warning
  the ticket flagged, thanks to React 19's host-singleton handling — but it still cannot exercise
  real layout, real navigation, or a real network/Service-Worker stack (MSW here runs in Node
  `fetch`-interception mode, not its browser Service Worker mode).
- TanStack Router's own official docs (`setup-testing`, see TanStack Start section below) recommend
  exactly this stack — Vitest + jsdom + `@testing-library/react` — as the default for router/component
  tests, though they explicitly do not address the SSR document shell.

**Speed**: fastest of all candidates, in-process, no browser process to launch. In this repo, the
whole suite runs in ~1.7s wall clock (measured above), dominated by jsdom environment boot, not by
test logic. This is the number the TDD loop currently gets.

**Fidelity**: lowest of all candidates for anything involving real layout, real
navigation/History API edge cases, real network stack, or real Service Workers. Good enough for DOM
structure, text content, accessibility roles, event handling, and (per the finding above) mounting
TanStack Start's document-shell root route without literal DOM-nesting violations.

## 2. Vitest Browser Mode (`@vitest/browser`, Playwright provider)

- Vitest Browser Mode overview (<https://vitest.dev/guide/browser/>, docs v4.1.9, checked July
  2026): "allows you to run your tests in the browser natively, providing access to browser
  globals like `window` and `document`." Supported providers: **Playwright** (recommended,
  supports parallel execution), WebdriverIO, and Preview (visualization only, not for CI).
  Requires Chrome ≥87, Firefox ≥78, Safari ≥15.4, Edge ≥88.
- Playwright provider config docs (<https://vitest.dev/config/browser/playwright>, checked July
  2026): as of Vitest 4, the provider ships as its own package,
  `@vitest/browser-playwright` (there was a prior API shape using a string `provider: 'playwright'`
  option on the older monolithic `@vitest/browser` package — the current major separates providers
  into their own npm packages; see the Migration Guide link in the docs nav for the v4 change).
  Configured as:
  ```ts
  import { playwright } from '@vitest/browser-playwright'
  test: { browser: { provider: playwright(), instances: [{ browser: 'chromium' }] } }
  ```
  Notably it documents first-class **MSW compatibility**: "HTTPS errors are automatically ignored
  and service workers permitted for MSW compatibility" — meaning MSW's real browser Service Worker
  mode (not just its Node `fetch`-patch mode) is a supported combination.
  Also documents a real constraint: "Vitest opens a *single* page to run all tests that are defined
  in the same file" — isolation is per-file, not per-test, unlike Playwright's own test runner.
- npm registry (checked July 2026): `@vitest/browser-playwright@4.1.10` and
  `@vitest/browser@4.1.10` — both match the exact Vitest version (`4.1.10`) already installed in
  `apps/web`, so there is no version-skew risk in adopting this today.
- React render adapter: `vitest-browser-react@2.2.0` (npm, checked July 2026) declares
  `peerDependencies: { react: "^18.0.0 || ^19.0.0", "react-dom": "^18.0.0 || ^19.0.0", vitest:
  "^4.0.0" }` — confirmed React 19 support, matching the repo's installed React `19.1.1`. Its
  `render()` is intentionally Testing-Library-shaped (the Vitest docs literally say "Vitest
  provides official packages for popular frameworks (`vitest-browser-react`...)"), so
  `render-app.tsx`'s current `render(<RouterProvider router={router} />)` call is expected to port
  with the import swapped, not rewritten. Crucially, the entire test file — including
  `createRouter`, `routeTree.gen.ts`, and MSW handler wiring — executes *inside* the browser via
  the Vite dev server; there is no Node↔browser serialization boundary to work around (unlike
  Playwright CT, see below).
- Runtime model: still driven from Vitest's CLI/watch-mode process; Playwright is used only as the
  **driver** that puppets a real browser tab, while Vitest's test collection, HMR-driven reruns,
  and reporter/UI stay the familiar Vitest experience. This is a genuine third point on the
  (a)/(b) spectrum the ticket asked about: it is not "jsdom" (real browser engine, real layout,
  real Service Workers) and it is not "Playwright's own test runner" (test authoring, watch mode,
  and file-level orchestration all stay Vitest-native).

**Speed**: Vitest's own docs (`/guide/browser/why`) state Browser Mode "requires spinning up the
provider and the browser during the initialization process, which can take some time," calling out
longer *initialization* specifically — but give no quantified number. No first-party benchmark
comparing jsdom vs. Browser Mode step times was found on vitest.dev. Directionally: expect browser
process startup (Playwright launching Chromium) to dominate the first-run cost, with watch-mode
reruns against an already-open page being cheaper than cold start — but this repo could not verify
that delta locally (see the "not run" note above), so treat the size of the gap as unverified until
someone measures it in this repo.

**Fidelity**: real browser DOM, real layout, real Service Workers (MSW's actual browser mode), real
`window.location`/History behavior — closes every gap jsdom's own README admits to.

**TanStack Start/Router compatibility**: no TanStack-specific blockers found; it is plain React
rendering in a real DOM, so `RouterProvider` + `routeTree.gen.ts` + a real `<html>` document shell
render exactly as they would in production, no singleton-fiber caveats needed the way jsdom needed
one.

## 3. Playwright Component Testing (`@playwright/experimental-ct-react`)

- Playwright's own docs (<https://playwright.dev/docs/test-components>, checked July 2026): the
  package is still named `@playwright/experimental-ct-{react,vue}` and the docs still frame it as
  experimental. npm registry confirms current published version `1.61.1` (checked July 2026,
  matching `@playwright/test@1.61.1` — no separate stable release track), still under the
  `experimental-ct-react` name after multiple years, i.e. it has not graduated to stable.
- Mounting model, per Playwright's own docs: `mount()` returns a Playwright **locator**, and
  "components run in the real browser environment, real clicks are triggered, real layout is
  executed" — but the test body runs in a **Node.js process** and the component runs in the
  **browser**, across a real process/bundle boundary. Consequences documented by Playwright
  itself: complex live objects (functions with closures, class instances) cannot be passed into
  `mount()`, only plain serializable data; module mocks don't automatically cross that boundary;
  synchronous callbacks from the browser back to the Node test body are awkward. Playwright's own
  recommended workaround is to build **wrapper "story" components** that convert live objects into
  serializable props before mounting — i.e. Playwright's own docs push users toward Storybook-style
  isolated component boundaries, which is exactly the shape the pyramid decision already rejected
  ("no isolated single-component tests").
- `beforeMount`/`afterMount` hooks do let you inject a router/providers around the mounted
  component, so it is *technically* possible to wrap a route in a router context — but the
  fundamental unit being mounted is still "one component tree handed across a serialization
  boundary," not "the app's real router resolving a real URL through the real route tree," the way
  `renderApp('/')` does today.
- React version support: no explicit React 19 compatibility statement found on the docs page
  itself. Community-reported testing (GitHub issue threads, e.g. #32167, #32853, checked via web
  search July 2026) shows people running Playwright 1.45–1.47 against both React 18.3 and React 19
  RC, so it is not blocked, but the package has multiple **currently open, unresolved rendering
  bugs** specific to the CT boundary (inline components declared as variables inside `mount()`
  failing to render — #32167; components with a `Fragment` root failing to render entirely —
  #32853), which is a direct risk for the auth flow's kind of test (conditional root
  rendering based on session state).
- The `playwright-ct-react` package.json (GitHub `main`, checked July 2026) pins
  `@vitejs/plugin-react` as its only React-adjacent dependency and has no `react`/`react-dom`
  version pin of its own — it defers to whatever the consuming project has installed, consistent
  with "not explicitly blocked" above.

**Speed**: real browser, so same order of magnitude as Vitest Browser Mode for the parts that
matter (browser process cost), but with the added Node↔browser round-trip overhead structurally
built into the mounting model — not quantified in the docs, but architecturally a strict superset
of the browser-mode overhead, not a subset.

**Fidelity**: full real browser, same as Browser Mode.

**TanStack Start/Router fit**: poor fit for this repo's chosen seam shape. This tool is designed
around mounting one component (optionally wrapped) with serializable props, not "resolve a real
URL through a real route tree and assert on the resulting document," and the pyramid decision
already explicitly ruled out isolated component mounting. Using it would mean fighting the tool's
mounting model to approximate what Vitest Browser Mode or jsdom already do more directly, plus
inheriting an experimental package's open rendering bugs.

## 4. Node.js built-in test runner (`node:test`) + `@testing-library/react`

- Node.js official docs (<https://nodejs.org/api/test.html>, checked July 2026): `node:test` is
  **Stability: 2 — Stable** (stable since Node 20, available since Node 18). It is a plain
  Node.js-process test runner with **no DOM or browser emulation of any kind built in** — no
  `document`, `window`, or any browser global. The docs do not mention jsdom, happy-dom, or
  `@testing-library/*` anywhere; there is no documented or first-party-supported combination.
- To use it for React component testing you would have to hand-roll exactly what Vitest's `jsdom`
  environment already does for free: construct a `JSDOM` instance yourself, assign `global.window`,
  `global.document`, etc., before importing React/Testing Library, and manage teardown/reset
  between tests yourself (no `environment: 'jsdom'` config knob — that's a Vitest/Jest concept, not
  a `node:test` one).
- TypeScript: `node:test`'s TypeScript support requires the `--no-strip-types` flag (or a
  transpile step) for `.ts` test file discovery per Node's own docs — an extra flag/config
  surface Vitest doesn't require (Vite handles TS transparently).
- No watch-mode/HMR-driven fast rerun loop comparable to Vitest's Vite-powered watch mode is
  documented for `node:test`; `node --test --watch` exists but re-runs whole files on change
  rather than Vite's granular HMR-aware invalidation.

**Verdict for this repo**: technically possible but not "real" in the sense the ticket asks about —
it would mean rebuilding, by hand and without first-party support, infrastructure (jsdom
environment wiring, TS handling, watch mode) that Vitest already ships. No primary source
documents this as a supported or recommended combination for React/router testing. Not a serious
candidate; excluded from the final recommendation for that reason, not on a vibe.

## 5. Storybook's test runner

- Storybook's own docs (<https://storybook.js.org/docs/writing-tests/integrations/test-runner>
  and <https://storybook.js.org/docs/writing-tests>, checked July 2026, plus
  `github.com/storybookjs/test-runner`): the test runner "turns all of your stories into
  executable tests," and is "powered by Jest and Playwright" under the hood. It executes against
  **stories** — i.e. it requires authoring Storybook stories as the unit of test, one per
  component/variant, run inside Storybook's own iframe-based preview.
  "Portable stories" (Storybook's newer feature) let you reuse a story's args/decorators inside
  Jest/Vitest/Playwright tests you write yourself, but the fundamental artifact being tested is
  still a **story bound to a single component**, not a route resolved through a real router.
- This model directly conflicts with the pyramid decision's explicit rejection of "isolated
  single-component tests": Storybook's whole design center is exercising one component (or one
  variant of one component) in isolation from the rest of the app's routing/provider tree. Getting
  a full-route, router-resolved integration test out of Storybook would mean writing a story whose
  "component" is the entire routed app shell — which is possible in principle but fights the tool's
  intended unit of authoring, and adds Storybook itself (a story-authoring UI, a build pipeline, a
  story-discovery convention) as a new piece of infrastructure whose primary value (visual
  component catalog / design-system documentation) this repo has no stated need for at the feature
  level.

**Verdict for this repo**: rejected. Not because it's technically incapable, but because adopting
it would mean bending a component-catalog tool to do what Vitest Browser Mode or jsdom already do
directly, for a testing shape the pyramid decision already ruled out, while adding an entire extra
tool surface for no fidelity or speed benefit over Browser Mode.

---

## TanStack Start / Router's own documented and internal testing approach

- Official "Set Up Testing" (code-based routing) doc
  (<https://tanstack.com/router/latest/docs/framework/react/how-to/setup-testing>, checked July
  2026): recommends **Vitest (or Jest) + jsdom + `@testing-library/react` +
  `@testing-library/jest-dom` + `@testing-library/user-event`**, rendering via
  `createMemoryHistory` + `RouterProvider`, and separately calls out **Playwright for e2e**. This
  is exactly the two-toolchain shape already locked in for this repo's pyramid (jsdom-ish for
  lower levels, Playwright for e2e) — it does **not** mention Vitest Browser Mode or Playwright CT
  as an option either way.
- Official "Test File-Based Routing" doc
  (<https://tanstack.com/router/latest/docs/how-to/test-file-based-routing>, checked July 2026):
  same stack, using `routeTree.gen.ts` directly, which is exactly this repo's setup already.
  **Neither official doc mentions the SSR document shell, `<html>/<head>/<body>` rendering, or any
  Start-specific hydration caveat** — TanStack's own docs are silent on the exact question this
  research ticket is about.
- TanStack's **own monorepo** (`github.com/TanStack/router`, `e2e/` directory, checked July 2026)
  ships dedicated `e2e/react-start/*` example apps (`basic`, `basic-auth`, `basic-react-query`,
  `rsc`, `server-functions`, `streaming-ssr`, and ~30 more Start-specific variants). Fetched
  `e2e/react-start/basic/package.json` directly: its only testing dependency is
  `"@playwright/test": "^1.50.1"`, with scripts `test:e2e:startDummyServer` /
  `test:e2e:local: "playwright test --project=chromium"` — **no Vitest, no jsdom, no
  `@testing-library/*` anywhere in that package**. For their own Start example apps — the closest
  analog to `apps/web` in the TanStack ecosystem — TanStack tests exclusively via Playwright
  against a real running server, not via jsdom-based component tests. That's a meaningful signal
  about where jsdom's coverage stops being trusted for Start apps specifically, even though it
  doesn't contradict jsdom's suitability for the router-level (non-Start-document) testing their
  own how-to docs describe.

Net: TanStack Router's public how-to docs back option (b)'s jsdom leg for router testing in
general; TanStack's own dogfooding of *Start* apps specifically skips jsdom entirely and goes
straight to Playwright. Neither source discusses or endorses Vitest Browser Mode or Playwright CT.

---

## Recommendation

**Adopt Vitest Browser Mode with the Playwright provider (`@vitest/browser-playwright` +
`vitest-browser-react`) for the feature level, replacing jsdom.** Keep it inside the Vitest
runner/config (same `vitest.config.ts`, same watch mode, same `pnpm test`) rather than moving to
Playwright's own test runner or Playwright Component Testing. This is the third, hybrid option the
ticket asked to watch for — not "jsdom for feature + Playwright for e2e" and not "Playwright
everywhere" in the sense of one runner/CLI for both levels, but "one real browser engine
(Chromium, via Playwright-the-driver) reused across both levels, orchestrated by two different
front-ends: Vitest's runner for feature, Playwright's own runner for e2e."

Concretely, that means declining both options as literally framed:

- **Not "jsdom for feature + Playwright for e2e" (status quo, option b's literal jsdom leg)**:
  defensible on raw speed (this repo's suite: 1.7s), and the specific "`<html>`-in-`<div>`"
  artifact the ticket flagged is not currently reproducible (React 19 host singletons handle it) —
  but jsdom's own README still admits it has no layout engine and cannot do real navigation, and
  TanStack's own Start example apps quietly skip jsdom entirely in favor of Playwright. Since the
  root route under test is a full document shell rendering `<head>`/meta/`<Scripts>`, a tool that
  structurally cannot lay anything out or navigate for real is a worse fidelity match than the
  ticket's framing even suggested, independent of the html-in-div correction above.
- **Not "Playwright everywhere" via Playwright Component Testing**: still `experimental` by its own
  package name after years, with currently open rendering bugs at exactly the seam this repo needs
  (fragment-root and inline-component mounting failures), and its Node↔browser process boundary
  actively pushes toward serializable-props "story" wrappers around isolated components — fighting,
  not fitting, the pyramid decision's "one real route through the real router" shape.
- **Not "Playwright everywhere" via plain Playwright browser automation against a served build**:
  not evaluated in a dedicated section above because the ticket's own framing (fast/mocked-network
  config vs. real-API config) concedes it would need a built/served app and a separate config
  layer to get MSW-speed iteration — which is precisely what Vitest Browser Mode already gives for
  free, inside the same tool the unit level already uses, without standing up a second full
  Playwright config.

**Speed-vs-fidelity tradeoff, stated plainly**: this level exists to drive the TDD red-green-refactor
loop, so speed is the dominant constraint per the locked decision — and Browser Mode is
*not free*, its own docs concede real browser/provider startup cost that jsdom doesn't pay. That
cost is real and currently **unverified in exact numbers for this repo** (the live comparison
wasn't safe to run here today, see above) — treat "how much slower" as the single most important
number for whoever picks up the follow-up decision ticket to actually measure, ideally with a
disposable branch, before committing. What tips the recommendation despite that open number: (1)
`vitest-browser-react`'s peer deps and Vitest's provider packages already match this repo's
installed Vitest `4.1.10` and React `19.1.1` exactly — zero version-skew risk, the migration is a
config change plus an import swap, not a rewrite of `render-app.tsx` or `auth-flow.test.tsx`'s test
bodies; (2) MSW's real browser Service Worker mode is documented as directly supported by the
Playwright provider, so the existing MSW-based mocking strategy carries over rather than being
replaced; (3) Playwright is already going to be a mandatory devDependency for e2e regardless of
this decision, so Browser Mode's Playwright provider is not a net-new tool to justify — it reuses
the same browser engine and driver e2e already needs, just fronted by Vitest instead of Playwright's
runner for this one level.

If the measured startup-cost gap (once someone actually benchmarks it in this repo) turns out to be
large enough to meaningfully slow the red-green loop on every save, the fallback is to keep jsdom
for the feature level after all and accept its documented layout/navigation gaps as a known,
bounded limitation — not to reach for Playwright CT or Storybook, both of which were rejected above
on tool-fit grounds independent of speed.
