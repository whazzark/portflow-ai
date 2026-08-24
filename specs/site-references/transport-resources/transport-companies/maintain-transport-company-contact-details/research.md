# Research: Maintain Transport Company Contact Details

No `NEEDS CLARIFICATION` items were carried into planning. The two product decisions the issue itself declared open — which contact fields are carried, and which of them are required — were clarified with the product owner during `/speckit-specify` and are fixed by FR-003 and FR-004. The decisions below resolve the technical ones.

## Decision 1: Carry the contact as two columns on `transport_companies`

**Decision**: Add `contact_phone` (`varchar(32)`, nullable) and `contact_email` (`varchar(255)`, nullable) directly to the existing `transport_companies` table in migration `1785200000000_add_transport_companies_contact_details.ts`, with a check constraint `transport_companies_contact_details_check` asserting `(contact_phone IS NULL) = (contact_email IS NULL)`.

**Rationale**: A transport company has exactly one contact, always recorded as a whole (FR-004), never versioned (spec assumption on history), and never queried independently. Two columns on the owning row are the smallest structure that expresses that, and they match how `customers` carries `code` and `company_name` inline. The check constraint turns FR-004's "always together" into an invariant the database itself holds, so no migration, seeder, or future slice can leave a company half-reachable — the same technique already used by `transport_companies_archived_at_check`.

**Alternatives considered**:

- A separate `transport_company_contacts` table: rejected as a one-to-one table with no independent lifecycle, no cardinality beyond one, and no query of its own; it would add a join to every consultation for no gain.
- A single JSON column: rejected because it defeats column-level length constraints and check constraints, and because PostgreSQL is the primary database precisely so that structure is typed (ADR 0002).
- A shared `contactable` concern across site references: rejected as speculative — no other site reference carries a contact today, and building the abstraction from one instance would guess at the second.

## Decision 2: Keep the columns nullable and enforce "required" at the write boundary

**Decision**: The columns stay nullable. Both `createTransportCompanyValidator` and `updateTransportCompanyValidator` require `contactPhone` and `contactEmail`, so every accepted write carries both. Rows created before this slice keep `NULL` in both and are never backfilled.

**Rationale**: FR-018 is explicit that pre-existing companies stay valid, must not receive placeholder values, and must supply real details on their next update. `NOT NULL` columns would force exactly the fabricated data the spec forbids, since no verifiable phone number or email address exists for the seeded providers. Putting the requirement in the validator keeps it where the rest of the input contract lives, and the check constraint from Decision 1 still forbids the only genuinely corrupt state — exactly one of the two present.

**Alternatives considered**:

- `NOT NULL` with a `''` default: rejected because an empty string is a value that reads as recorded and would defeat the "not recorded" display state (FR-020, SC-008).
- `NOT NULL` after a data migration filling placeholders: rejected by FR-018 in as many words.
- Making the fields optional on `PATCH` so a legacy company can be renamed without supplying them: rejected because it would leave companies permanently unreachable and contradicts FR-004; the price is that renaming a legacy company now also requires recording its contact, which is the intended forcing function.

## Decision 3: Widen both delivered write contracts rather than adding a third endpoint

**Decision**: Keep `POST /api/v1/transport-companies` and `PATCH /api/v1/transport-companies/:id` as the only write contracts and add the two required fields to both request bodies. No `PATCH /:id/contact` sub-resource is introduced.

**Rationale**: The issue states the slice "widens the accepted contract on both paths as well as the directory details panel". Contact details are attributes of the company, not a sub-resource with its own lifecycle, and PATCH already expresses partial update of the company. A dedicated endpoint would need its own policy ability, its own use case, and its own web mutation, all to write two columns on a row the existing endpoint already writes. Reusing the transformer for the response means the web layer needs no new shape.

**Alternatives considered**:

- A `PATCH /:id/contact` sub-resource: rejected as above; it would also make "change the name and the phone in one submission" impossible without two round trips and an inconsistent intermediate state.
- Leaving `POST` untouched and only widening `PATCH`: rejected because it would let a company be born unreachable, which is precisely the gap FR-002 and User Story 3 close.
- Versioning the endpoints to preserve the old body shape: rejected because ADR 0005 generates the only client from this contract inside the same monorepo; there is no external consumer to keep compatible.

## Decision 4: Define the accepted phone format as a shared Vine rule

**Decision**: Add `app/shared/validators/contact_validator.ts` exporting a `phoneNumber()` rule created with `vine.createRule`. A value is accepted when, after trimming, it contains only digits, spaces, and the separators `+`, `-`, `.`, `(`, `)`; a `+` may appear only as the first character; and it contains at least 6 and at most 20 digits. The email address uses Vine's built-in `.email()`, the same rule the login validator already applies.

**Rationale**: FR-010 fixes the accepted character set but deliberately leaves the exact format to design, so this decision states it openly rather than letting it emerge from an implementation. The character set covers both `+33 2 40 12 34 56` and `02.40.12.34.56` without normalizing either, which spec assumption "stored as submitted after trimming" requires. The digit floor rejects values that pass a pure character-set check while being unusable — `+`, `()`, `--` — and the ceiling keeps a value inside the 32-character column even with separators. Placing the rule under `app/shared/validators/` rather than in `site_references/shared/site_reference_validator.ts` reflects that a phone format is not a site-reference concept; `nonBlank` stays where it is.

**Alternatives considered**:

- A full E.164 parser or `libphonenumber`: rejected as a new runtime dependency for reference data that operations dials manually, and because it would force normalization the spec explicitly declined.
- Character-set validation only, with no digit floor: rejected because `"+"` and `"()"` would both be stored as recorded contacts and would satisfy SC-008 while being unreachable.
- Storing a normalized canonical form alongside the raw value: rejected as unrequested storage with no consumer; no search, sort, or match is performed on the phone number.

## Decision 5: Re-assert the contact rules in the domain, mirroring the name

**Decision**: Add `app/transport_companies/shared/normalize_transport_company_contact.ts` exporting `assertValidContactPhone` and `assertValidContactEmail`, which trim and re-validate, throwing `InvalidTransportCompanyContactPhoneException` (`422`, `E_TRANSPORT_COMPANY_CONTACT_PHONE_INVALID`) and `InvalidTransportCompanyContactEmailException` (`422`, `E_TRANSPORT_COMPANY_CONTACT_EMAIL_INVALID`). Both use cases call them exactly where they already call `assertValidSiteReferenceName`.

**Rationale**: This is the delivered pattern: the HTTP validator guards the boundary, the domain re-asserts so the invariant holds for any caller, and trimming happens in both places so the stored value is normalized regardless of entry point (FR-008). Distinct codes per field satisfy FR-022's requirement that refusals be distinguishable, and mirror `E_SITE_REFERENCE_NAME_INVALID`, which is likewise only reachable when the domain is called directly.

**Alternatives considered**:

- Trust the Vine validator alone: rejected because the use case is a public boundary reachable from seeders and future workflows, and because it would make the unit suite unable to prove normalization without going through HTTP.
- One combined `assertValidContact` taking both values: rejected because it cannot report which field was wrong, collapsing two of the refusals FR-022 requires to be distinct.
- Reuse the site-reference invalid-name exception: rejected because error codes are part of the public contract and must name the field they describe.

## Decision 6: Extend the existing repository commands and conditional write

**Decision**: `CreateTransportCompanyCommand` and `UpdateTransportCompanyCommand` each gain `contactPhone: string` and `contactEmail: string`. `LucidTransportCompanyRepository.create` passes them through; `updateAvailable` adds them to the same `UPDATE ... WHERE id = ? AND status = 'AVAILABLE'` statement. `TransportCompanyWriteResult` is unchanged.

**Rationale**: The lifecycle guard must stay atomic with the write for spec edge case 1 — a company archived after the form opened is refused, not silently updated — and that property comes from the single conditional statement already in place. Adding columns to the same statement preserves it for free. No new result variant is needed because no new refusal originates in persistence: contact values have no uniqueness rule (FR-014), so they cannot raise a unique violation.

**Alternatives considered**:

- A separate `updateContact` repository method: rejected because it would need its own lifecycle guard and would make "rename and re-contact in one submission" two statements with a visible intermediate state.
- Load, mutate, and `save()` the model: rejected because the lifecycle guard would no longer be atomic with the write.
- Add a `CONTACT_CONFLICT` result variant for symmetry with `DUPLICATE_NAME`: rejected because FR-014 makes it unreachable; an unreachable variant is a lie the type system would keep telling.

## Decision 7: Expose both fields through the existing transformer

**Decision**: Add `contactPhone` and `contactEmail` to the `pick` list in `TransportCompanyTransformer`. Every endpoint returning a transport company — `index`, `available`, `store`, `update` — carries them automatically, and the generated Tuyau types propagate them to `TransportCompanyDto` on the web without a hand-written type.

**Rationale**: FR-019 requires every user permitted to consult companies to read the contact, including on archived ones, and both consultation endpoints already run through this transformer. ADR 0005 makes the web DTO derived from the API contract, so a single transformer change is what makes the fields available to the details panel, and no client type drifts.

**Alternatives considered**:

- Expose the contact only on the detail endpoints: rejected because there is no detail endpoint — the web details panel reads from the already-loaded collection, so hiding the fields from `index` would hide them from the panel.
- Hide the contact from non-administrators: rejected by the spec assumption that contact details are business reference data whose whole purpose is to be readable during a truck shortage.
- Nest them as a `contact: { phone, email }` object: rejected because flat fields match every other attribute on this resource and keep the form field names, the validator field names, and the `422` `details[].field` values aligned, which is what makes `applyValidationError` attach messages to the right input.

## Decision 8: Widen the single shared web form, and add a contact section to the details panel

**Decision**: `TransportCompanyForm` — already the single component behind both `CreateTransportCompanyPanel` and `EditTransportCompanyPanel` — gains `contactPhone` and `contactEmail` fields, its Zod schema mirrors the server rules, and its `defaultValues` read `company?.contactPhone ?? ''`. `TransportCompanyDetails` gains a contact section between the identity fields and the lifecycle section: when both values are present it renders two `ResourceDetailField`s; when both are absent it renders one explicit "No contact details recorded" message.

**Rationale**: Because both write paths already funnel through one form, widening it satisfies FR-002, FR-021, and User Story 3 in one change, and a legacy company opened for editing naturally presents empty required fields — exactly the forcing function FR-018 describes. The section-level empty state is used rather than two per-field "Not specified" labels because FR-004 makes "exactly one recorded" impossible, so the only empty state is "neither", and one honest sentence reads better than two identical placeholders.

**Alternatives considered**:

- Two per-field `ResourceDetailField`s with the component's built-in "Not specified": rejected because it describes a partial state that cannot occur and reads as two independent gaps rather than one un-migrated company.
- Rendering the values as `tel:` and `mailto:` links: rejected for this slice because the issue's scope boundary places "sending anything to a recorded contact" outside it; plain selectable text keeps the outcome (SC-005) without reaching toward that boundary. Worth revisiting as its own decision if operations asks for it.
- Separate create and edit forms: rejected as duplication of a validation contract that must stay identical on both paths.
- Adding contact values to the directory search filter: rejected as unrequested; no functional requirement mentions searching by contact, and `transportCompanyMatchesSearch` stays name-only.

## Decision 9: Seed one deliberately un-migrated company

**Decision**: `TRANSPORT_COMPANY_FIXTURES` gains contact values for every company except one — the `archivedNullable` entry, "Noroît Logistique" — which keeps both columns `NULL`. `TransportCompanyFactory` gains faker-driven defaults plus a `withoutContact` state producing both as `NULL`. The web fixture collection mirrors this with one company carrying no contact.

**Rationale**: FR-018 and SC-008 both describe behavior that only exists in the presence of a company with no contact recorded. Without a seeded example, the "not recorded" display state, the check constraint's tolerance of `(NULL, NULL)`, and the "must supply details on the next update" rule are all untestable through the real dataset and would only ever be exercised by hand-built rows. Reusing the fixture that already represents a historical record with missing data keeps the dataset's intent coherent.

**Alternatives considered**:

- Give every fixture a contact and build the legacy case per test: rejected because the browser flow in the quickstart also needs to show the empty state, and a hand-built row would not appear there.
- Add a seventh fixture company for this case: rejected as dataset growth when an existing fixture already models "historical provider retained without complete data".

## Decision 10: Test through real persistence and the real router

**Decision**: Add `tests/unit/transport_companies/administration/contact_details.spec.ts` and `tests/integration/transport_companies/administration/contact_details.spec.ts` for the new rules, and widen the payloads in the delivered `create.spec.ts` and `update.spec.ts` suites. On the web, add `__tests__/administration/contact-details.test.tsx` and `__tests__/details/contact.test.tsx`, and widen the existing administration tests and support helpers.

**Rationale**: This follows the seams the resource already uses. Real persistence is what proves the check constraint, the nullable-at-rest behavior, and that a refused submission leaves previously recorded values untouched; MSW through the real Tuyau client is what proves a `422` with two field errors attaches messages to the right two inputs. The delivered suites failing on their old `{ name }` payloads is the expected first signal that the contract widened, and repairing them is part of the same change.

**Alternatives considered**:

- Fake the repository in unit tests: rejected because the check constraint and the nullable-at-rest behavior are precisely what must be proven.
- Test the form component in isolation: rejected as the primary seam because it cannot show pre-filling from a legacy company, cache invalidation, or the refusal-then-correct loop; acceptable as a supplement.
- Leave the delivered suites on their old payloads by making the fields optional in tests: rejected because it would prove a contract the product does not have.
