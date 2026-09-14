# Contract: the `/profile` screen and its menu entry

**Feature**: [spec.md](../spec.md) · **Date**: 2026-09-11

The web half of the self-service identity update. It adds one route, one feature module, and one
enabled menu item. The users workbench at `/users` is untouched: an organization admin's own row
still offers no `Edit`, as GH-24 delivered it.

## Entry point

In `apps/web/src/components/layout/user-menu.tsx`:

| Before | After |
|---|---|
| Disabled item **Profile**, with a **Coming soon** badge | Enabled item **Profile**, same `UserRoundIcon`, linking to `/profile` |

It is offered to every signed-in user: past the `_authenticated` guards, every user is active and
owes no renewal. The menu closes on navigation. The label is discussed in research.md D10.

The existing `components/layout/__tests__/authenticated-layout/user-menu.test.tsx` expectations for
the placeholder, "Coming soon" and the disabled item, are replaced by the enabled entry and its
navigation.

## Route

`apps/web/src/routes/_authenticated/profile.tsx`:

| Aspect | Value |
|---|---|
| Path | `/profile` |
| Guards | Inherited from `_authenticated`: signed-out visitors go to `/login`, a renewal owed goes to `/password-renewal` |
| `staticData.breadcrumb` | `Your identity` |
| Search parameters | None: the whole state is "the form is open", which the path already says |
| Loader | None. The page reads the session user from `useAuthenticatedUser()`, already ensured by the layout |
| Component | `OwnProfilePage` from `features/profile/ui/own-profile-page.tsx`; the route file stays thin |

## Feature module

```text
apps/web/src/features/profile/
├── mutations/use-own-profile-update.ts
├── ui/own-profile-page.tsx
├── ui/own-profile-form.tsx
└── __tests__/
    ├── edit.test.tsx          # journey, names-only update, unchanged submission, menu refresh
    ├── email.test.tsx         # password field appears/disappears, required, incorrect, re-casing
    ├── refusals.test.tsx      # validation, conflict, invalid identity
    └── recovery.test.tsx      # network/5xx retry, 401 and renewal-owed handling, stale address
```

`features/users/helpers/identity-schema.ts` is new: the first name, last name, and email Zod rules,
moved out of `edit-user-form.tsx`. Both `EditUserForm` and `OwnProfileForm` use them.

## The page

A page header titled **Your identity**, with a one-line description saying that the email address is
the one used to sign in. Below it, `OwnProfileForm` in a column of the same width as the other
forms.

## The form

`useAppForm` with the registered field components, `applyValidationError`, `FormError`, and
`SubmitButton`:

| Field | Pre-filled with | Shown | Client rule |
|---|---|---|---|
| First name | session `firstName` | always | shared schema: required, non-blank, ≤ 255 |
| Last name | session `lastName` | always | shared schema: required, non-blank, ≤ 255 |
| Email | session `email` | always | shared schema: required, well-formed, ≤ 255 |
| Current password | empty | only while the typed email differs from the session's, trimmed and case-insensitive | required while shown; `type="password"`, `autoComplete="current-password"` |

The description under the current password reads: "Your email address is how you sign in. Confirm
the change with your current password."

Submit: **Save changes**, pending label from `WRITE_PENDING_LABELS.update`. There is no **Cancel**:
leaving the page abandons the change, and nothing has been written until submission (US1-5).

The client rules spare a round trip. The API's refusals are the authority.

## Outcomes

| API result | Screen |
|---|---|
| `200` | The `auth.me` cache is set from the response, then every other query is invalidated. Success toast from `helpers/resource-copy`. The user menu and the form show the new identity at once. The current password is cleared and hidden, because the address now matches |
| `200`, unchanged submission | The same success; nothing moves |
| `422 E_VALIDATION_ERROR` | Field errors; input kept; current password cleared |
| `422 E_CURRENT_PASSWORD_REQUIRED` | Error on the current password field. `auth.me` is refetched (D12). If that shows an address an administrator moved while the form was open, the email field is re-seeded with it, the current password is cleared, and a form-level message names the change: "Your email address was changed by an administrator since you opened this page. It now reads …". The form never asks for a password to put back an address the user never saw replaced |
| `422 E_CURRENT_PASSWORD_INCORRECT` | Error on the current password field, which is cleared; identity input kept |
| `409 E_USER_EMAIL_CONFLICT` | Error on the email field: the address is already used; input kept; current password cleared |
| `422 E_USER_IDENTITY_INVALID`, network, `5xx` | `FormError` with the API's words, plus a failure toast; input kept; current password cleared; submitting again retries (US5) |
| `401` | `resetSession` and `router.invalidate()`; the guards send the user to `/login`. No toast |
| `403 E_PASSWORD_RENEWAL_REQUIRED` | `resetSession` and `router.invalidate()`; the guards send the user to `/password-renewal`. No toast |

A refused or failed submission is never presented as applied (FR-017). After every submission that
did not apply, the current password is empty (FR-019).

## The password section (US6, added 2026-09-14)

Below the identity, on the same page, separated from it: a heading **Password**, a line saying the
change keeps the current connection and ends the others, and `OwnPasswordForm`.

| Field | Shown | Client rule |
|---|---|---|
| Current password | always | required; `type="password"`, `autoComplete="current-password"` |
| New password | always | `newPasswordSchema`, shared with the renewal screen: 12–128 characters; `autoComplete="new-password"`; described as "At least 12 characters." |
| Confirm new password | always | required, and equal to the new password |

The match is checked **on submission only**, never on blur — the rule `own-profile-form.tsx` records:
a cross-field rule judged as the first field is left leaves an error on a field the user has not
reached, and TanStack Form then drops their first click.

Submit: **Change password**, pending label from `WRITE_PENDING_LABELS.update`.

| API result | Screen |
|---|---|
| `200` | Toast "Password changed"; the three fields are emptied; the session cache is seeded from the response; the user stays where they are |
| `422 E_CURRENT_PASSWORD_INCORRECT` | Error on the current password field, which is emptied; the new password typed is kept |
| `422 E_PASSWORD_UNCHANGED` | Error on the new password field |
| `422 E_VALIDATION_ERROR` | `applyValidationError`, onto the field the API names — `passwordConfirmation` for a mismatch |
| Network, `5xx` | `FormError` plus the toast "Unable to change your password"; the current password is cleared |
| `401`, or `403 E_PASSWORD_RENEWAL_REQUIRED` | `resetSession` and `router.invalidate()`, as for the identity: the guards send the user to sign-in or to the renewal, with no toast |

After any submission that did not apply, the current password field is empty (FR-019's rule, applied
to this form too).

## MSW

`apps/web/src/test/msw/handlers.ts` gains a default handler for `PATCH /api/v1/me/profile` that
answers with the submitted identity merged into the session user. Tests override it per scenario,
in the shape the other handlers already have.
