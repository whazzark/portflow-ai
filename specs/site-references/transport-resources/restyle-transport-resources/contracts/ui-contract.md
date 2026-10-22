# Contract: Transport resources accessible UI

The roles and accessible names the tests and assistive technology rely on. Wording comes from the
*Retenue* artboards; «x» is interpolated.

## Toolbar

| Element | Role / name |
|---|---|
| Search | `searchbox` "Search transport resources", placeholder "Search registration, model or company" |
| Status pills | `group` "Filter by truck status" containing `button`s "Available N", "Suspended N", "Archived N" with `aria-pressed` |
| Create (administrators) | `button` "Create" + `button` "Choose what to create" (`aria-haspopup="menu"`) → `menuitem`s "Truck", "Transport company" |
| Company filter banner | text "Showing «company»", `button` "Show all companies", text "N other companies hidden" |
| Archived notice | text "Reactivate the company first to reactivate one of its trucks." |

## Table

| Element | Role / name |
|---|---|
| Table | `table` "Trucks by transport company" |
| Sortable headers | `columnheader` Registration, Vehicle model, Capacity, Status with `aria-sort`; Suspension and Actions not sortable |
| Group toggle | `button` "Collapse «company»" / "Expand «company»", `aria-expanded` |
| Company filter | `button` "Show only «company»" (the group's name) |
| Group menu (administrators) | `button` "Actions for «company»" → `menuitem`s "View details", "Edit", "Add truck", separator, "Archive" (disabled with "Still provides N available truck(s)") — archived company: "View details", "Reactivate" |
| Archived company | text "Archived", archive comment “…” · actor, date; `button` "Reactivate" (administrators) |
| Truck row | `row` with an activatable cell "View truck «registration»" |
| Return to service (suspended, administrators) | `button` "Return «registration» to service" |
| Reactivate (archived, administrators) | `button` "Reactivate «registration»" (disabled when the company is archived) |
| Truck menu (administrators) | `button` "Actions for «registration»" → available: "View", "Edit", "Suspend", separator, "Archive"; suspended: "View", "Return to service"; archived: "View", "Reactivate" |
| Status pill | text Available / Suspended / Archived |

## Detail rows

| Element | Role / name |
|---|---|
| Truck detail | `region` "Truck «registration»", `heading` "Truck", `heading` "History"; `button` "Hide details for «registration»" (`aria-expanded="true"`) |
| Suspended truck hint | text "Return it to service before editing or archiving it." + `button` "Return to service" |
| Company detail | `region` "Transport company «name»", fields Contact phone, Contact email, Created, Last updated; `button` "Edit"; `button` "Archive" (disabled with "Can be archived once it provides no available truck (N today).") |

## Inline forms

| Element | Role / name |
|---|---|
| Create company row | `form` "Create transport company": `textbox` "Company name", "Contact phone", "Contact email"; `button` "Create"; `button` "Cancel new company" |
| Create truck row | `form` "Create truck": `textbox` "Registration", "Vehicle model", "Capacity (tonnes)"; `combobox` "Transport company" (from Create) or text "Added to «company»" (from Add truck); `button` "Save"; `button` "Cancel new truck" |
| Edit truck row | `form` "Edit «registration»": same fields + `combobox` "Transport company"; `button` "Save"; `button` "Cancel edit" |
| Edit company | `form` "Edit «name»": company fields; `button` "Save"; `button` "Cancel edit" |
| Field errors | associated with their field (`aria-describedby`); form-level error in a `alert` inside the row |

## Dialogs and feedback

| Action | `alertdialog` title | Comment placeholder | Confirm |
|---|---|---|---|
| Suspend | "Suspend «registration»?" | "Why is this truck suspended? (breakdown, maintenance…)" | "Suspend" |
| Return to service | "Return «registration» to service?" | "What was done? (optional)" | "Return to service" |
| Archive truck | "Archive «registration»?" | "Why is this truck archived?" | "Archive" |
| Reactivate / archive company | existing shared copy | existing | existing |

Every dialog: `textbox` "Comment (optional)", max 1,000 characters, `button` "Cancel".

Suspension toast (`status`): "Truck «registration» suspended" with description "It stays in its
current discharges." Other actions keep the shared success and refusal toasts.

## No match

`table` row containing text "No truck or company matches “«term»”", the explanation, `button`
"Clear search" and (when archived is not pressed) `button` "Include archived".

## Read-only

No Create, no "Actions for …", no Return to service / Reactivate buttons, no Edit / lifecycle
buttons in details, no form rows.
