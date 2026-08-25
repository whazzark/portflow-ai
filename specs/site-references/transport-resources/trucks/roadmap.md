# Roadmap: Trucks

**GitHub Issue**: [#49](https://github.com/whazzark/portflow-ai/issues/49)
**Parent Roadmap**: `specs/site-references/transport-resources/roadmap.md`
**Domain**: site-references

| Issue | Slice | Status | Artifact |
|---|---|---|---|
| #222 | List Trucks | backlog | pending selection |
| #223 | Create a Truck | backlog | pending selection |
| #224 | Update a Truck | in-progress | `./update-a-truck/` |
| #225 | Archive a Truck | selected | `specs/site-references/transport-resources/trucks/archive-a-truck/spec.md` |
| #226 | Reactivate a Truck | implemented | `specs/site-references/transport-resources/trucks/reactivate-a-truck/spec.md` |
| #252 | Suspend a Truck From Service | implemented | `specs/site-references/transport-resources/trucks/suspend-a-truck-from-service/spec.md` |
| #253 | Return a Truck to Service | implemented | `specs/site-references/transport-resources/trucks/return-a-truck-to-service/spec.md` |

Truck creation and update include the transport-company assignment rules. Lifecycle actions preserve
registration identity and historical assignments. Suspension (`#252`) adds a third lifecycle
state for temporary immobilization, distinct from archival; `#253` delivers its reverse transition,
which is gated on the truck's transport company still being available.
