# UI Contract: Customers workbench (V2)

The observable interface tests and reviewers rely on: roles, accessible names, copy and URL
parameters. Visual values come from the V2 theme tokens and the design canvas; they are not
repeated here. `{…}` are placeholders.

## URL (unchanged)

`/customers?search=&status=available|archived&availableSort=code|companyName|reactivationComment&availableOrder=asc|desc&archivedSort=code|companyName|archiveComment&archivedOrder=asc|desc&customerId=&mode=view|edit|create`

## Toolbar and tabs

| Element | Role / name | Copy | Visible to |
|---------|-------------|------|------------|
| Search | `searchbox` "Search customers" | placeholder "Search by code, company name or comment" | all |
| Create | `button` "Create customer" (plus icon) | "Create customer" | administrators |
| Tabs | `tablist` "Customer status"; `tab` "Available {n}", "Archived {n}" | | all |

## Tables

`table` "Available customers" / "Archived customers".

| Tab | Columns (header text) |
|-----|------------------------|
| Available | [selection] · Customer code · Company name · Reactivation comment · Reactivated · Actions |
| Archived | [selection] · Customer code · Company name · Archive comment · Archived · Actions |

Selection and Actions columns are rendered for administrators only.

| Element | Role / name |
|---------|-------------|
| Header checkbox | `checkbox` "Select all available customers" / "Select all archived customers" |
| Row checkbox | `checkbox` "Select customer {code}" |
| Code link | `link`/`button` "View customer {code}" (monospaced) |
| Row menu trigger | `button` "Actions for {code}" (today: company name; switched to the code as drawn and as FR-008 states) |
| Lifecycle cell | "{First Last} · {d MMM yyyy}" (Available), "{First Last} {d MMM yyyy}" (Archived), or "—" |

Row menu items: Available → "View", "Edit", separator, "Archive" (destructive). Archived →
"View", "Reactivate".

## No-match and empty

| State | Title | Description | Actions |
|-------|-------|-------------|---------|
| Search, no match in tab | "No available customer matches “{term}”" / "No archived customer matches “{term}”" | "Search looks in customer codes, company names and lifecycle comments." + " {n} archived customer(s) match." / " {n} available customer(s) match." when > 0 | "Clear search"; "Show archived" / "Show available" when the other tab matches |
| No search, empty tab | "No available customers" / "No archived customers" | "No customers have been added yet." (Available) / "No customer has been archived." (Archived) | "Create customer" for administrators on Available |

## Detail sheet

`dialog` named by the company name.

- Header: company name, code (monospaced), `button` "Close".
- Summary `dl`: Status (dot + "Available"/"Archived"), Customer code, Created, Last updated.
- `section` "History": ordered list, newest first; item = "{Archived|Reactivated}", "{dd/mm/yyyy,
  hh:mm}", actor chip, "“{comment}”" (omitted when empty). Empty: "No lifecycle history yet."
- Footer (administrators): Available → `button` "Edit", `button` "Archive"; Archived →
  `button` "Reactivate".
- Unresolvable id: title "Unable to load customer" (unchanged).

## Create sheet

`dialog` "Create customer"; description "Available as soon as it is created"; `form` "Create
customer"; fields "Customer code", "Company name"; hint "The code identifies the customer in
discharges and reports. It is stored in uppercase and can be changed later."; footer button "Create
customer" (no footer "Cancel"; left through "Close"). Code conflict → `code` field error "Already used by {companyName}.".

## Edit sheet

`dialog` "Edit customer"; description "{companyName} · {code}"; `form` "Edit customer"; code field
description "Stored in uppercase. Reports already generated keep the previous code."; header button
"Back to details"; footer button "Save changes" (no footer "Cancel").

## Lifecycle dialogs

| Dialog | `alertdialog` title | Description | Comment placeholder | Buttons |
|--------|---------------------|-------------|---------------------|---------|
| Archive | "Archive {companyName}?" | "{code} can no longer be added to a new discharge. Past discharges and reports keep it. You can reactivate it later." | "Why is this customer archived?" | "Cancel", "Archive" (destructive) |
| Reactivate | "Reactivate {companyName}?" | "{code} can be added to new discharges again. Its archive stays in the history." | "Why is this customer reactivated?" | "Cancel", "Reactivate" |
| Bulk archive | "Archive selected customers?" (shared) | shared count sentence + list of "{code} {companyName}" | "Why are these customers archived?" | "Cancel", "Archive {n} customer(s)" (destructive) |
| Bulk reactivate | "Reactivate selected customers?" (shared) | shared count sentence + list | "Why are these customers reactivated?" | "Cancel", "Reactivate {n} customer(s)" |

Comment label "Comment (optional)" everywhere (shared).

## Bulk action bar

`toolbar` "Bulk customer actions" (shared name): "{n} selected" (+ "· {h} hidden by the search"),
visible "Archive"/"Reactivate" with accessible name "Archive selected"/"Reactivate selected",
visible "Clear" with accessible name "Clear selection".

## Toasts (shared copy, unchanged)

| Event | Toast |
|-------|-------|
| Create | "Customer “{companyName}” created" |
| Update | "Customer “{companyName}” updated" |
| Archive | "Customer “{companyName}” archived" |
| Reactivate | "Customer “{companyName}” reactivated" |
| Bulk, none skipped | "{n} customer(s) archived" / "reactivated" |
| Bulk, some skipped | "{n} customer(s) archived; {m} customer(s) unchanged" — description "{code}: {reason}, …" |
| Bulk, all skipped | "{m} customer(s) unchanged" — description as above |
