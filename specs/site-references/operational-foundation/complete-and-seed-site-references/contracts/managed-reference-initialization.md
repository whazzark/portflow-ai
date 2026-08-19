# Contract: Managed Site-Reference Initialization

This is an internal database-initialization contract for development and test environments. It is
not an HTTP, Tuyau or user-facing mutation contract.

## Invocation

The supported entry points remain:

```bash
pnpm --filter @portflow/api db:fresh
pnpm --filter @portflow/api db:seed
```

Seeders run in this dependency order: Users; Customers; Transport Companies; Docks; Weighing
Areas; Warehouses and footprints; Warehouse Doors; Trucks.

## Managed keys and required scenarios

The implementation keeps the existing declared records and adds or enriches records only where a
scenario is missing. At minimum, these stable exemplars prove the three lifecycle scenarios:

| Kind | Available exemplar | Archived exemplar | Previously reactivated exemplar |
|---|---|---|---|
| Customer | `ATL-CER` | `CVN-001` | `ARM-FROID` |
| Dock | `Môle d'Escale Ouest` | `Chef de Baie 3` | `Bassin à flot 2` |
| Weighing Area | `Pont-bascule Nord` | `Ancien pont-bascule Chef de Baie` | `Pont-bascule Sud` |
| Warehouse | `SICA Atlantique - Silos céréaliers` | `Ancien entrepôt Chef de Baie` | `Atlantique Logistique - Hangar 7` |
| Warehouse Door | `SICA Atlantique - Silos céréaliers / Porte Nord` | `SICA Atlantique - Silos céréaliers / Porte Historique` | `Atlantique Logistique - Hangar 7 / Porte de Service` |
| Transport Company | `Atlantique Transport Routier` | `Loire Vrac Transport` | `Estuaire Bennes` |
| Truck | `AA-101-PF` | `ZZ-909-PF` | `CC-303-PF` |

All lifecycle occurrences are literal ISO timestamps, not values computed from the execution time.
The lifecycle actor is `thomas.bernard@portflow.ai`, resolved by exact normalized email; actor
absence is an initialization error for scenarios that declare an actor.

## Matching and convergence

- Matching is case-insensitive by Customer code, Truck registration, or resource name; a Door is
  matched by resolved Warehouse UUID plus case-insensitive name.
- Zero matches creates one row. One match updates that row without changing its UUID. More than one
  match where the database cannot enforce uniqueness fails with an actionable error.
- All declared scalar values, lifecycle facts, parents, coordinates and ordered footprint points
  converge to the contract. No lifecycle timestamp is advanced merely because initialization reruns.
- A missing declared parent fails initialization. It is never silently skipped or replaced by a
  different parent.
- A second successful run preserves every managed UUID and parent UUID and produces the same
  logical values and counts. It adds no reference, relation, lifecycle occurrence or footprint point.
- An interrupted run may leave accepted rows; the next successful run converges them without
  creating a second logical identity.

## Integrity postconditions

- Each of the seven kinds has at least one available, archived and previously reactivated row.
- Every managed archived row has an archive occurrence and comment; every managed reactivated row
  is available and has retained archive context followed by reactivation context.
- Every actor FK resolves to a User when present; removing that User leaves all other history intact.
- Every Truck resolves to its declared Transport Company with positive capacity and required registration.
- Every Door resolves to its declared Warehouse, is inside/on its footprint, and retains its scoped
  normalized name. All Doors under an archived managed Warehouse are archived.
- Geographic values and Warehouse footprint ordering satisfy existing database/domain constraints.
- A record or footprint owned by a key outside this contract is not deleted, renamed, reparented,
  archived, reactivated or otherwise claimed.

## Compatibility boundary

No route, authorization rule, filter, ordering rule, empty/failure behavior, response envelope or
DTO changes. In particular, Warehouse and Warehouse Door lifecycle metadata is persisted for later
business rules but is not added to their existing response shapes by this issue. Existing
consultation suites are regression tests for this boundary.
