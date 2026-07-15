# Session Cookie Authentication

Authenticate users through `@adonisjs/auth`'s session guard, backed by a Lucid user provider on the `User` model, with session state carried by `@adonisjs/session`'s cookie store rather than a server-side session store. The cookie itself holds the encrypted session payload, so no session table or cache is required to authenticate a request.

Login (`POST /auth/login`) verifies credentials and the user's `ACTIVE` access status inside the use case, rather than delegating credential verification to the guard's built-in `verifyCredentials` helper. This keeps the access-status gate and the credential check as one business decision, and lets a single generic `InvalidCredentialsException` cover every rejection reason — unknown email, wrong password, or inactive status — without revealing which one applied.

The automated test suite substitutes an in-memory session store (`SESSION_DRIVER=memory`, set through `.env.test`) so a request's session data can be asserted synchronously in tests; the cookie store's payload is opaque to the session test helpers, which expect a server-side, session-ID-keyed store to read back from.

## Consequences

Every environment other than automated tests relies on the cookie for session state: there is no session persistence layer to run, back up, or scale, but a session's data is bounded by cookie size and lives entirely on the client between requests. Session restoration (`GET /auth/me`) and logout (`POST /auth/logout`) reuse the same guard and cookie store: both require the `web` guard through `auth_middleware`, and neither carries business logic beyond reading or clearing the authenticated user.
