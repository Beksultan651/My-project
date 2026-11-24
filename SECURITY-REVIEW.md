# Security Review

## Scope

This audit covers the Next.js finance API, JSON storage, frontend synchronization, `.env` handling, and Git ignore rules for the backend changes.

## Found Issues

| Severity | Issue | Status |
|---|---|---|
| HIGH | The API had no authentication or authorization and could read, replace, or delete the shared JSON dataset. | Resolved with a shared-password session; per-user authorization is not provided |
| MEDIUM | `DELETE` was not serialized with JSON writes, so concurrent operations could recreate or remove data unpredictably. | Resolved |
| MEDIUM | Frontend snapshots are sent as complete files and concurrent writes can be last-writer-wins. | Unresolved |
| LOW | POST and PUT have replacement semantics but no revision or compare-and-set check. | Unresolved |

## Implemented Fixes

- A shared-password login is available at `POST /api/auth/login`. It sets a signed, 24-hour session cookie; `POST /api/auth/logout` expires the browser cookie.
- Finance GET, POST, PUT, and DELETE routes reject requests without a valid signed session.
- Configure `FINANCE_API_KEY` as an environment variable with at least 32 characters. It is the shared login password and HMAC signing secret; no credential is stored in source code.
- The session cookie is `HttpOnly`, `SameSite=Strict`, path-scoped to `/`, and `Secure` on HTTPS requests.
- Same-origin requests are allowed only when scheme, hostname, and port match the incoming request's host/proxy headers.
- Cross-origin login, logout, and mutation requests are denied.
- In-memory rate limits protect login (5/minute), GET (60/minute), and writes (30/minute) per client-address/type pair.
- The rate limiter prunes expired keys and caps its in-memory address table.
- Write and delete operations now share one in-process mutation queue.
- Atomic temporary-file rename remains in place for JSON writes.
- JSON payloads are validated with `isFinanceData()` before writing.
- Invalid JSON, missing `data`, and invalid finance data return HTTP 400 responses.
- `.env*` and `data/finance.json` remain excluded from Git.

## Not Implemented

- This is one shared password, not individual user accounts or per-user authorization.
- Logout removes the browser cookie; because sessions are stateless, a copied cookie remains valid until its 24-hour expiry.
- Rate limiting is process-local; it resets on server restart and is not distributed across multiple server instances.
- Rate limit client identity relies on forwarding headers supplied by the deployment proxy. Configure the proxy to overwrite untrusted forwarded headers.
- The shared full-file JSON model remains vulnerable to stale concurrent snapshots because no revision or compare-and-set mechanism is present.
- There is no backup or database transaction system.

## Residual Risk

The session protects a single shared dataset, not multiple users. Set `FINANCE_API_KEY` outside source control and use HTTPS in deployment. Concurrent clients may still overwrite newer snapshots.
