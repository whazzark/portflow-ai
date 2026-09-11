# Contract: Activation screen (`/activate/$token`)

**Feature**: [spec.md](../spec.md) · **Routes**: `src/routes/_activation.tsx`,
`src/routes/_activation/activate.$token.tsx` · **Screen**:
`src/features/auth/ui/activation-screen.tsx` · **Research**:
[D10](../research.md#d10--the-secret-leaves-the-activation-screen-nowhere),
[D11](../research.md#d11--a-pathless-_activation-layout-not-_guest),
[D12](../research.md#d12--the-preview-is-a-query-keyed-by-the-token-never-retried-or-cached)

## URL

`/activate/<token>` is the link GH-7 issues: `${WEB_ORIGIN}/activate/<secret>`. The route takes no
search parameter. The token is read from the path parameter only, and is never written to the query
cache's persisted state, `localStorage`, or any URL the screen builds.

## Layout

`_activation` renders `GuestLayout`, the same split-screen surface as login and password renewal.

- **Head**: `<meta name="referrer" content="no-referrer">`.
- **`beforeLoad`**: resolves the session through `ensureSessionUser`. A `401` means no session and is
  not an error. It never redirects.
- **Production**: nginx serves `/activate/` with `access_log off` and
  `Referrer-Policy: no-referrer` (D10).

## States

The screen shows exactly one state at a time, chosen in this order:

| # | Condition | Presented | Actions |
|---|---|---|---|
| 1 | Preview loading | The GuestLayout surface with no form; nothing to act on yet | — |
| 2 | Preview `404 E_ACTIVATION_LINK_UNUSABLE` | Heading "This activation link can't be used". Body: "If you've already activated your access, log in with your password. Otherwise, ask an organization admin for a new link." No name and no email. | Link to `/login` |
| 3 | Preview network or unknown failure | "We couldn't check this activation link." | "Try again" refetches the preview |
| 4 | Preview `200` and a session exists (`auth.me` answered, confined or not) | The identity from the preview ("This link activates the access of Claire Martin, claire.martin@portflow.test"), then "You're logged in as <session user's first and last name>. Log out to continue with this activation." No password form. | "Log out" runs the existing `useLogout`. The screen stays on the same URL and moves to state 5. |
| 5 | Preview `200` and no session | The same identity, then the password form | Submit, "Activate" |
| 6 | Acceptance answered `500 E_INVITATION_ACCEPTED_SESSION_NOT_OPENED` | "Your access is active. Log in with the password you just chose." | Link to `/login` |

Button labels carry the action only ("Activate", "Log out", "Try again").

## Password form (state 5)

- **Fields**: `password` and `passwordConfirmation`, both password inputs with `autocomplete="new-password"`.
  The email is also present as a read-only `autocomplete="username"` value, so a password manager
  stores the credential against the right account (clarification 4).
- **Client rules**: the shared new-password schema (D8). On blur, 12 to 128 characters and a
  non-empty confirmation. On submit, the confirmation must match, and the error is reported on
  `passwordConfirmation`. The API stays authoritative.
- **Submit**: `SubmitButton` with pending label "Activating…".

The screen answers each outcome of `auth.invitation_acceptance.store` as follows:

| API answer | Screen behavior |
|---|---|
| `200` | `resetSession(queryClient)`, then `router.navigate({ to: '/', search: { section: 'rotations' }, replace: true })`. The browser lands where a login lands, and the activation URL is replaced in history. |
| `422 E_VALIDATION_ERROR` | `applyValidationError` places the details on their fields. The values stay entered. A detail on `token` renders state 2. |
| `404 E_ACTIVATION_LINK_UNUSABLE` | State 2. |
| `409 E_INVITATION_ACCEPTANCE_SESSION_OPEN` | `resetSession`, then `router.invalidate()`. The refreshed `auth.me` renders state 4. |
| `500 E_INVITATION_ACCEPTED_SESSION_NOT_OPENED` | State 6. |
| Network or unknown failure | `FormError` "We couldn't activate your access. Try again." The values stay entered and the form stays submittable (FR-021). |

## What the screen never does

- Build, display, or copy the token anywhere on the page.
- Offer "remember me" (clarification 2).
- Let the invited person edit their name or email.
- Redirect a signed-in user away. It names them instead (clarification 1).
