# Implementation Plan: Maintain Transport Company Contact Details

**Branch**: `feat/254-transport-company-details` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/site-references/transport-resources/transport-companies/maintain-transport-company-contact-details/spec.md`

## Summary

Widen the delivered transport-company vertical slice so a company carries how to reach it. The `transport_companies` table gains two nullable columns, `contact_phone` and `contact_email`, plus a check constraint that keeps them either both present or both absent. Both delivered write contracts — `POST /api/v1/transport-companies` and `PATCH /api/v1/transport-companies/:id` — require both fields from now on, so every company created or updated after this slice is reachable, while the rows seeded before it stay valid and unreachable until someone edits them. The Vine validators gain a shared phone-format rule and Vine's email rule; the use cases re-assert both through domain normalizers, mirroring how `assertValidSiteReferenceName` already guards the name. The transformer exposes both values, which carries them to the web through the existing Tuyau contract with no new response shape. On the web side the single `TransportCompanyForm` used by both the create and the edit panel gains two required fields, and `TransportCompanyDetails` gains a contact section that renders the two values or one explicit "no contact details recorded" message. No uniqueness rule, no history, and no messaging is added.

## Technical Context

**Language/Version**: TypeScript 5.7 (API) and TypeScript 5.9 (web), Node.js 22 toolchain

**Primary Dependencies**: AdonisJS 7.3, Lucid 22.4, Bouncer 4, VineJS 4, Tuyau 1.2, TanStack Start/Router 1.168/1.170, TanStack Query 5.101, TanStack Form, React 19.1, Zod 4.4, shadcn/Base UI, Sonner

**Storage**: PostgreSQL in runtime; in-memory SQLite through Lucid for automated API tests. Both support the nullable string columns and the boolean check constraint this slice adds.

**Testing**: Japa 5.3 API unit/integration suites against the real Lucid repository; Vitest 4.1, Testing Library, and MSW router-level web feature tests

**Target Platform**: Linux-hosted API and server-rendered web application; modern desktop and mobile browsers

**Project Type**: PNPM/Turbo monorepo web application with separate API and web workspaces

**Performance Goals**: Under normal conditions, a create or update submission produces a confirmed result or an explicit refusal within 2 seconds for at least 95% of attempts

**Constraints**: The API stays authoritative for authentication, authorization, lifecycle rules, and validation; both contact fields are required together on every accepted write and optional only at rest; archived companies stay read-only; identity, name, lifecycle status, lifecycle context, and truck associations are preserved; no uniqueness rule applies to contact values; no contact history is kept; no message is ever sent to a recorded contact; no new runtime dependency is introduced

**Scale/Scope**: One site's low-cardinality reference collection; two new columns and one check constraint, two widened write contracts, one shared validation rule, two new form fields, one new details section, and their API/web test seams

## Constitution Check

### Pre-design gate

- **I. Selected feature intent is versioned — PASS**: GitHub issue #254 is selected on `feat/254-transport-company-details` and its reviewed `spec.md` is the behavioral contract. The two decisions the issue left open — which fields, and which are required — were clarified with the product owner and are recorded in FR-003 and FR-004 rather than invented here.
- **II. One independently deliverable feature per spec — PASS**: Carrying contact details, requiring them on both write paths, showing them in the directory, and their tests form one mergeable outcome. Listing (#217), archival (#220), and reactivation (#221) stay in their own issues, and messaging a contact is explicitly outside the issue.
- **III. Vanilla Spec Kit gates protect product intent — PASS**: The spec was reviewed before planning and this plan stops at the human plan-review gate. No material ambiguity was resolved silently; the one rule the spec deliberately left to design — the exact accepted phone format — is stated openly in research Decision 4.
- **IV. Test-first observable behavior — PASS**: API behavior starts from Japa unit and integration specs; web behavior starts from router-level Vitest/MSW feature tests. Every refusal listed in FR-022 gets a named failing test before implementation, and the widened contract makes the existing create/update specs fail first, which is the intended RED signal.
- **V. Deep boundaries and explicit contracts — PASS**: The use cases own the normalization and refusal decisions, the repository owns the conditional write, the controller and policy own HTTP adaptation and authorization, Tuyau carries the typed contract, and the web feature owns form and view adaptation. No layer is bypassed.
- **VI. Durable knowledge has a home — PASS**: `CONTEXT.md` already defines Transport Company; this slice adds attributes to it rather than new vocabulary, so no glossary entry is required. The design applies ADRs 0002, 0003, 0005, and 0008 without amending them, so no new ADR is required.
- **VII. Verification is part of delivery — PASS**: The quickstart defines focused API/web checks, the repository-wide `pnpm check`, `pnpm typecheck`, `pnpm test`, and the affected browser flow.
- **VIII. One workflow owner — PASS**: Spec Kit artifacts stay in this feature directory; no parallel delivery-state mechanism is added.

### Post-design re-evaluation

**PASS**. The data model, HTTP contract, and validation guide preserve every pre-design gate.

Three design points deserve to be stated explicitly rather than buried:

- **This slice breaks two delivered request contracts on purpose.** `POST /api/v1/transport-companies` and `PATCH /api/v1/transport-companies/:id` previously accepted `{ name }`; after this slice a body without `contactPhone` and `contactEmail` is refused with `422`. FR-004 cannot be honored any other way, the API has no consumer outside this monorepo (ADR 0005 makes the web client generated from the API contract), and the web form is updated in the same change. The existing `create.spec.ts` and `update.spec.ts` suites fail until their payloads are widened; that is the RED step, not a regression.
- **The columns are nullable in the database while being required by the application.** This is the direct consequence of FR-018: the companies seeded before this slice must stay valid without being handed fabricated contact data. The invariant that is actually enforceable at rest — never exactly one of the two — is enforced by a check constraint, so a half-recorded row cannot exist even through a migration or a fixture. Making the columns `NOT NULL` would require inventing placeholder values, which the spec explicitly forbids.
- **No uniqueness index is added.** FR-014 is a deliberate absence, not an oversight: several transport companies can legitimately share a dispatcher or a shared mailbox. This is called out because every other string column this resource carries (`name`) is unique, so the difference is worth being explicit about.

No constitution exception requires complexity tracking.

## Project Structure

### Documentation (this feature)

```text
specs/site-references/transport-resources/transport-companies/maintain-transport-company-contact-details/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── http-api.md
└── tasks.md              # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
apps/api/
├── app/
│   ├── shared/
│   │   └── validators/
│   │       └── contact_validator.ts                   # new — shared phoneNumber Vine rule
│   └── transport_companies/
│       ├── create/
│       │   └── create_transport_company_use_case.ts   # accept + normalize contact input
│       ├── update/
│       │   └── update_transport_company_use_case.ts   # accept + normalize contact input
│       └── shared/
│           ├── normalize_transport_company_contact.ts # new — trim + assert phone/email
│           ├── repositories/
│           │   ├── transport_company_repository.ts    # widen create/update commands
│           │   └── lucid_transport_company_repository.ts
│           ├── transport_company_exceptions.ts        # add two invalid-contact exceptions
│           ├── transport_company_transformer.ts       # expose contactPhone + contactEmail
│           └── transport_company_validator.ts         # require both fields on both writes
├── database/
│   ├── factories/
│   │   └── transport_company_factory.ts               # contact defaults + withoutContact state
│   ├── fixtures/
│   │   └── transport_companies.ts                     # contact values + one legacy company
│   ├── migrations/
│   │   └── 1785200000000_add_transport_companies_contact_details.ts   # new
│   └── schema.ts                                      # regenerated, never hand-edited
└── tests/
    ├── integration/transport_companies/administration/
    │   ├── contact_details.spec.ts                    # new
    │   ├── create.spec.ts                             # widened payloads
    │   └── update.spec.ts                             # widened payloads
    ├── integration/transport_companies/consultation/   # assert the two exposed fields
    ├── integration/trucks/administration/create.spec.ts   # factory-driven, verify only
    └── unit/transport_companies/administration/
        ├── contact_details.spec.ts                    # new
        ├── create.spec.ts                             # widened input
        └── update.spec.ts                             # widened input

apps/web/
├── src/
│   ├── features/transport-companies/
│   │   ├── __tests__/
│   │   │   ├── administration/
│   │   │   │   ├── contact-details.test.tsx           # new
│   │   │   │   ├── create.test.tsx                    # fill the two new fields
│   │   │   │   └── update.test.tsx                    # pre-fill + change assertions
│   │   │   ├── details/
│   │   │   │   └── contact.test.tsx                   # new — recorded vs not recorded
│   │   │   └── support/
│   │   │       ├── fixtures.ts                        # contact values + a legacy company
│   │   │       └── test-helpers.ts                    # widened POST/PATCH interception
│   │   └── ui/
│   │       ├── transport-company-form.tsx             # two required fields
│   │       ├── transport-company-details.tsx          # contact section + empty state
│   │       ├── create-transport-company-panel.tsx     # widened submit value type
│   │       └── edit-transport-company-panel.tsx       # widened submit value type
│   ├── features/transport-resources/ui/
│   │   └── transport-resources-workspace.tsx          # widened mutation payloads
│   └── test/msw/handlers.ts                           # default company payload gains the fields
```

**Structure Decision**: Extend the existing two-workspace vertical-slice architecture in place; no new feature module, route, endpoint, or panel is introduced. On the API side the change is concentrated in the delivered `transport_companies` slice, with the only new shared artifact being a reusable `phoneNumber` Vine rule placed under `app/shared/validators/` because a phone format is not a site-reference concept — `nonBlank` stays where it is. On the web side both write paths already funnel through one `TransportCompanyForm`, so widening that single component covers creation and editing at once, and the details panel gains a section beside the existing lifecycle section. Generated files — `apps/api/database/schema.ts`, the Tuyau contract in `apps/api/.adonisjs/`, and the TanStack route tree — are refreshed by their existing generators, never edited by hand.

## Complexity Tracking

No constitution violations require justification.
