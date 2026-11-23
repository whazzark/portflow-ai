# Contract: `GET /api/v1/discharges` (`discharges.index`)

Authentication and authorization are unchanged (every active role; 401 otherwise). The response
stays `{ data: DischargeListEntry[] }`, ordered by `expectedStartAt` then `id`. Changes are
additive; existing fields keep their meaning.

```jsonc
{
  "data": [
    {
      "id": "uuid",
      "status": "ACTIVE",                      // PLANNED | ACTIVE | CLOSED
      "vesselName": "MV Mistral",
      "vesselImo": "9399906",                  // or null
      "expectedStartAt": "2026-09-12T04:00:00.000Z",
      "dock": { "id": "uuid", "name": "Anse Saint-Marc 2" },
      "productLots": [
        { "id": "uuid", "customerId": "uuid", "customerName": "Flandres Conteneurs", "productName": "Wheat" }
      ],
      "shiftCount": 11,

      // New
      "startedAt": "2026-09-12T04:00:00.000Z", // or null
      "expectedTonnage": "8419.750",           // fixed three decimals
      "activeShift": {                         // ACTIVE discharges only, else null
        "id": "uuid",
        "sequence": 7,
        "plannedStartAt": "2026-09-14T16:00:00.000Z",
        "plannedEndAt": "2026-09-15T04:00:00.000Z",
        "responsible": { "id": "uuid", "firstName": "Sophie", "lastName": "Dubois" }
      },
      "nextShift": null,                       // same shape; ACTIVE discharges only
      "startProblemCount": null                // PLANNED discharges only: 0 = Ready, n = problems
    }
  ]
}
```

## Guarantees

- For a planned discharge, `startProblemCount` equals `data.problems.length` of
  `GET /api/v1/discharges/:id/start-check` read at the same moment.
- For an active discharge, `activeShift` is its only `ACTIVE` shift, and `nextShift` its `PLANNED`
  shift with the lowest `sequence`.
- No closure time field is added by this slice.

## UI contract (web)

| Tab | Columns |
|-----|---------|
| Active | Vessel (IMO beneath), Dock, Started, Active shift, Expected tonnage, Customers, Open |
| Planned | Vessel (IMO beneath), Dock, Expected start, Preparation, Lots · tonnage, Customers, Open |
| Closed | Vessel (IMO beneath), Dock, Started, Closed (placeholder), Expected tonnage, Customers, Open |

- Active shift cell: "Shift k / n", planned period, responsible name; otherwise "No shift in
  progress" plus "Next: Shift k / n …" when `nextShift` exists.
- Preparation badge: `Ready` (success tone, check icon) or `1 problem` / `n problems` (warning tone,
  alert icon).
- Customers: two names, then « +N » with a tooltip listing all; em dash when none.
- Absent values: muted `Not specified` for IMO and Started; muted em dash for Closed.
- No-match: "No matching discharges", the searched term, the searchable fields, and a `Clear search`
  button. Tab counts stay status totals.
