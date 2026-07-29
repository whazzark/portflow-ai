# UI Contract: Customer Workbench

- Authenticated route: `/customers`.
- Search parameters preserve status tab, normalized search text, per-tab sort/order, selected detail `customerId`, and detail `mode` (`create`, `edit`, `view`). Invalid combinations are normalized away.
- Available and archived customers are separate accessible tables. Archived rows remain visible and inspectable but cannot expose edit controls.
- Active non-admin users can search, sort, inspect, and consult lifecycle metadata. Admins additionally see create, edit, individual lifecycle, and selection-scoped bulk lifecycle controls.
- Create/update use the shared application form and show field-level validation plus a form-level API error. Lifecycle actions use confirmation and optional comments.
- Bulk feedback identifies every blocked record and its reason; successful records are not presented as failed. After a mixed result, the lists are refreshed, changed IDs are cleared from selection, and blocked IDs remain actionable until the user removes or retries them. Selection is cleared after a fully successful mutation or filter/status changes.
- Loading and retryable error states are represented by route pending/error components; all controls have accessible names and keyboard-operable behavior.
