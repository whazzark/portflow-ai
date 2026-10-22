# Contract: Shared lifecycle and resource primitives touched by this feature

These are the additions to shared web components. Every addition is optional; omitting it keeps
today's behavior and copy exactly, so other features need no change. Sibling V2 restyles (#317,
#319, #320, #321, #326) can adopt them.

## `components/lifecycle/resource-lifecycle-actions.tsx`

`ResourceLifecycleConfig` gains:

```ts
/** Replaces the canonical "Archive customer?" title, e.g. to name the record. */
describeTitle?: (action: LifecycleAction) => string
/** Placeholder for the comment field. No placeholder when omitted. */
commentPlaceholder?: (action: LifecycleAction) => string
```

## `components/lifecycle/bulk-resource-lifecycle-actions.tsx`

`BulkResourceLifecycleSubmissionProps` gains:

```ts
/** Records listed under the description, in this order. Nothing is listed when omitted. */
selection?: readonly { id: string; primary: string; secondary?: string }[]
/** Confirm button label for the selection size, e.g. "Archive 3 customers". */
describeConfirm?: (action: LifecycleAction, count: number) => string
/** Placeholder for the comment field. No placeholder when omitted. */
commentPlaceholder?: (action: LifecycleAction) => string
```

`BulkResourceLifecycleActions` (toolbar) changes visually to the V2 bar for every resource. Its
role, accessible name and the accessible names of its buttons are unchanged; visible button text
becomes the action alone and "Clear".

## `components/lifecycle/resource-lifecycle-history.tsx` (new)

```ts
export function ResourceLifecycleHistory(props: { blocks: LifecycleBlock[] }): JSX.Element
```

Renders a `section` labelled "History" with an ordered timeline of `orderLifecycleBlocks(blocks)`
(past-tense action, date and time, actor chip when the block carries one, quoted comment when
present) or "No lifecycle history yet." `ResourceLifecycleSummary` is unchanged.

## `components/resource/resource-actor.tsx` (new)

```ts
export function ResourceActor(props: {
  actor: { firstName: string; lastName: string } | null
  at?: string | null          // rendered with formatShortDate, muted
  separator?: '·' | ' '       // between name and date; default '·'
}): JSX.Element               // "—" when actor is null
```

## `helpers/dates.ts`

```ts
/** "14 Aug 2026" — day, short month, year, en-GB. "—"-free: returns '' for null. */
export function formatShortDate(value: string | null): string
```
