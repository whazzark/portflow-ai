# CI constraints for `apps/web` e2e testing

Research ticket, wayfinder #127 follow-up (tracked as issue #132). Investigates this repo's actual
CI constraints for running the e2e level the pyramid decision commits to — a **comprehensive**
suite, run **in CI**, against a **real `apps/api` instance with a real database** (locked by ticket
#128, "Test pyramid shape and philosophy for apps/web"). Specifically: whether/how GitHub Actions
service containers can stand up Postgres for the e2e job, Playwright's browser-binary caching story,
realistic CI-minutes cost at "comprehensive suite" scope, and what trigger this should run on, given
`cd-production.yml` reuses `ci-checks.yml` as its `verify` job. This note is decision input, not the
decision — see the closing section for the still-blocked follow-up ticket that makes the actual
tooling/trigger call.

Matches the citation/dating convention of the sibling research notes
(`docs/research/feature-level-test-framework.md`,
`docs/research/feature-level-mocking-strategy.md`,
`docs/research/e2e-tooling.md`): facts about this repo were checked directly by reading the
source files; external facts (GitHub Actions docs, Playwright docs, GitHub billing docs) were
checked live in July 2026 against the primary source cited, not from training-data memory.

## Corrected premise: `apps/api`'s own suite does not run against a real database today

The ticket's own framing (and the tooling research note, #131) assumed CI Postgres provisioning
would "mirror how `apps/api`'s own test suite already runs against a real database." That premise
is **false as currently configured**. `apps/api/.env.test` sets `DB_CONNECTION=sqlite`, and
`apps/api/config/database.ts` resolves that to an **in-memory `better-sqlite3`** connection
(`filename: ':memory:'`), not the `postgres` connection block in the same file. `ci-checks.yml` sets
`NODE_ENV: test`, which AdonisJS uses to load `.env.test` — so in CI today, `apps/api`'s test suite
runs entirely against in-memory SQLite. The `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/
`DB_DATABASE` env vars set in `ci-checks.yml` (and passed through by `turbo.json`'s `test` task
`passThroughEnv`) are configured but currently **dead** for CI purposes — nothing in the test run
resolves to the `postgres` connection block that would consume them. There is no existing "real
database in CI" precedent in this repo to mirror; provisioning Postgres for the e2e suite is new
infrastructure, not a port of an existing pattern.

## Current CI pipeline shape

Read directly from `.github/workflows/ci-checks.yml` and `.github/workflows/cd-production.yml`:

- `ci-checks.yml` triggers on `push: branches: [master]`, **every** `pull_request` (no path
  filter — any change in the repo, `apps/web`-only or not, runs the full job), and
  `workflow_call` (reusable). Its one job (`checks`) runs on `ubuntu-latest`: checkout, pnpm/node
  setup, `pnpm install --frozen-lockfile`, `pnpm check` (format/lint), `pnpm typecheck`, `pnpm test`.
- `cd-production.yml` triggers on `release: published` and `workflow_dispatch`. Its `verify` job is
  `uses: ./.github/workflows/ci-checks.yml` — a direct reuse, not a duplicate or a subset — gating
  the `build` job (which builds and pushes both Docker images to `ghcr.io`) via `needs: verify`.
  **Confirmed: yes**, whatever `pnpm test` covers at release time blocks every production deploy,
  since `build` cannot start until the reused `ci-checks.yml` job succeeds.
- No `services:` block exists anywhere in either workflow today — no Postgres, no other containerized
  service. No browser-binary caching (`actions/cache` or otherwise) exists anywhere in
  `.github/workflows/`, and no `playwright` reference exists anywhere in the repo outside
  `pnpm-lock.yaml`'s transitive tree (confirmed by grep) — both "there isn't yet" claims in the
  ticket body are confirmed accurate.
- `turbo.json`'s `test` task has `"cache": false` and a fixed `passThroughEnv` allowlist (`TZ`,
  `PORT`, `HOST`, `LOG_LEVEL`, `APP_KEY`, `NODE_ENV`, `DB_HOST`, `DB_PORT`, `DB_USER`,
  `DB_PASSWORD`, `DB_DATABASE`, `WEB_ORIGIN`). Root `package.json`'s `test` script is `turbo run
  test`, and `apps/web/package.json`'s `test` script is `vitest run` — this is why `pnpm test`
  already picks up `apps/web`'s feature-level suite with no extra wiring, exactly as the ticket
  states. **This does not generalize to a new e2e suite automatically**: turbo dispatches by
  *script name* across workspace packages, so a Playwright suite only joins `pnpm test` (and
  therefore both `ci-checks.yml`'s gate and `cd-production.yml`'s `verify` gate) if it is wired
  into a package's `test` script specifically. Naming it something else (e.g. `test:e2e`, or a new
  turbo task `e2e`) would **not** run automatically under the current `pnpm test` / `ci-checks.yml`
  path — that's a deliberate wiring choice still open, not a given.

## Postgres service container feasibility

GitHub Actions' own docs on containerized service containers
(<https://docs.github.com/en/actions/use-cases-and-examples/using-containerized-services/creating-postgresql-service-containers>,
checked July 2026) confirm this is a standard, well-documented capability — not a stretch for this
repo's setup:

```yaml
services:
  postgres:
    image: postgres
    env:
      POSTGRES_PASSWORD: postgres
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

For a job running directly on the `ubuntu-latest` runner (not inside a container itself, which is
how `checks` in `ci-checks.yml` already runs), the service is reached via `localhost` on the mapped
port — i.e. `DB_HOST: 127.0.0.1`, `DB_PORT: 5432`, already exactly the values `ci-checks.yml` sets
today (see above — currently dead, but the right shape to reuse once `DB_CONNECTION` is switched to
`postgres` for the e2e step). The service runs for the entire job and is torn down automatically
when the job ends; no persistent infrastructure or external hosting is needed. This is a same-job
addition to the existing `checks` job, or a new job/workflow — either is mechanically
straightforward.

## Browser-binary caching: the ticket's premise doesn't hold either

The ticket asks to research "Playwright's official browser-binary caching action." **No such action
exists, and Playwright's own CI docs actively recommend against caching browser binaries**:
Playwright's official CI guide (<https://playwright.dev/docs/ci>, checked July 2026) states caching
"is not recommended, since the amount of time it takes to restore the cache is comparable to the
time it takes to download the binaries," and separately notes that on Linux, OS-level dependencies
required alongside the browsers "are not cacheable" at all. The same page does allow that *if*
caching is attempted anyway, the guidance is to key it against a hash of the installed Playwright
version — but this is presented as the exception, not the recommended path. Net: this repo does not
need to build browser-binary caching into its e2e CI job. The realistic per-run fixed cost is
`npx playwright install --with-deps chromium` (or equivalent) on every run, not a cache-miss
penalty on top of a caching layer — one fewer moving part than the ticket assumed, not an unsolved
gap.

## Trigger cadence: three options, cost/latency tradeoffs, decision deferred

The pyramid decision (#128) already commits to "runs in CI" as a safety net written after a feature
is green — but not to a specific trigger. Three shapes, sized against this repo's actual pipeline
wiring above:

1. **Same job/trigger as everything else** (add e2e into `checks` in `ci-checks.yml`, or a step
   gated by the same `pull_request`/`push`/`workflow_call` triggers). Runs on every PR, every push
   to `master`, and every production release (via `cd-production.yml`'s `verify` reuse) — maximal
   safety-net coverage, matching "safety net" framing most literally, but adds e2e's full latency
   (service container startup + migrations + browser install + test run) to every PR's feedback
   loop, including PRs that don't touch `apps/web`, since `ci-checks.yml` has no path filtering
   today.
2. **Separate job/workflow, same triggers, but decoupled from `pnpm test`.** A dedicated `e2e` turbo
   task or a second workflow_call'd workflow, still triggered on every `pull_request`/`push`/release,
   but able to run in parallel with `checks` (or be its own required status check) rather than
   serially inside it — same coverage as option 1, better wall-clock via parallel jobs, but still
   pays full CI-minutes cost on every trigger.
3. **Scheduled/gated, decoupled from the PR and deploy path** — a `schedule:` cron trigger (nightly)
   or a PR-label gate, keeping `ci-checks.yml`/`cd-production.yml` untouched. Cheapest and fastest
   day-to-day, but weakens the "safety net before deploy" intent from #128, since a release could
   ship without a same-day e2e run having covered it, and a regression could sit undetected until
   the next scheduled run.

Choosing between these is explicitly **not** this ticket's job — it's the input the still-blocked
follow-up decision ticket needs, alongside the tooling recommendation from #131.

## CI-minutes cost: order-of-magnitude, not a quote

This repo is a **private** GitHub repository (confirmed via `gh repo view`), so GitHub Actions
minutes are metered, not unlimited. Per GitHub's billing docs
(<https://docs.github.com/en/billing/concepts/product-billing/github-actions>, checked July 2026):
private repos on the Free plan get **2,000** included minutes/month, Team gets **3,000**/month;
beyond the included allotment, standard Linux (`ubuntu-latest`, 2-core) runners are billed at
**$0.006/minute**.

A precise per-run cost cannot be stated without the actual suite (none exists yet — confirmed no
Playwright anywhere in the repo), but the cost drivers are countable now: fixed per-run overhead
(service container startup + health check, `pnpm install`, browser install, DB migrations against
the fresh Postgres container — each on the order of tens of seconds, not minutes, per the GitHub
Actions and Playwright docs cited above) plus variable cost that scales with the number of full user
journeys in the suite and whether `--shard` parallelism is used (shards reduce wall-clock time but
do not reduce total billed runner-minutes — GitHub bills per job-minute across all shards, not
per-suite wall-clock). A single-browser (chromium-only), non-sharded run of a suite in the tens of
journeys is plausibly a low-single-digit number of minutes on top of `ci-checks.yml`'s existing
lint/typecheck/unit-test cost; this will grow as "comprehensive" is fleshed out over time and should
be re-measured against the real suite once one exists, not budgeted from this estimate alone.

---

## Summary for the follow-up ticket

- Postgres via a GitHub Actions service container is straightforward and well-precedented —
  standard `services:` YAML, reachable via `localhost:5432` inside the existing job shape, no new
  infrastructure. This is **not** a port of an existing `apps/api` pattern, since `apps/api`'s own
  CI suite runs on in-memory SQLite today, not Postgres — a premise correction worth carrying into
  the tooling decision.
- Browser-binary caching is a non-issue: Playwright's own docs recommend against it, so there's
  nothing to design here.
- `cd-production.yml` reusing `ci-checks.yml` as `verify` is confirmed — any e2e suite wired into
  `pnpm test` blocks every production release, and (via `ci-checks.yml`'s unfiltered `pull_request`
  trigger) every PR, not just `apps/web`-touching ones. Wiring is a deliberate choice, not automatic:
  unlike the existing Vitest suite, a new e2e suite only joins `pnpm test` if named into a `test`
  script explicitly.
- CI-minutes cost is real but not prohibitively large at today's likely suite scale (private repo,
  metered beyond 2,000 free minutes/month at $0.006/min) — worth re-measuring once a real suite
  exists rather than gating the tooling decision on this estimate.
- Trigger cadence (every PR/push, decoupled parallel job, or scheduled/gated) is a genuine open
  choice with real tradeoffs between safety-net coverage and day-to-day PR latency — deferred to the
  follow-up ticket alongside the tooling choice from #131.

**This note is decision input only.** The actual e2e tooling + CI-approach choice belongs to the
still-blocked follow-up ticket, gated on both this research note and the e2e-tooling research note
(issue #131).
