# Scrub secrets before sharing (`=scrub`)

Type `=scrub`, paste a log, HTTP exchange, JSON API response or `.env`, press Enter: you copy
the same text back with credentials and personal data masked. Everything else is untouched,
so the paste still explains the bug.

## Who it is for

Developers and support engineers who paste debugging material into a ticket, Slack or an AI
assistant. The secret is rarely the point of the paste, and it is easy to miss one line in 200.

## What it masks

| Found | Becomes |
|---|---|
| `-----BEGIN ... PRIVATE KEY-----` blocks | `[REDACTED_PRIVATE_KEY]` |
| `Authorization: Bearer/Basic/Token/Bot <value>` | `Authorization: Bearer [REDACTED]` |
| `Cookie:` / `Set-Cookie:` values | `Cookie: [REDACTED]` |
| `X-Api-Key`, `Api-Key`, `X-Auth-Token` headers | `X-Api-Key: [REDACTED]` |
| JWTs (`eyJ...`) | `[REDACTED_JWT]` |
| AWS access key ids, GitHub, Slack, Stripe, Google, `sk-` API keys | `[REDACTED_<KIND>]` |
| Credentials in a URL (`postgres://user:pass@host`) | `postgres://[REDACTED]@host` |
| `password`, `secret`, `token`, `api_key`, `access_token`... as JSON keys, query params or env vars | `"password": "[REDACTED]"` |
| Email addresses | `[EMAIL]` |

Status codes, error codes, paths, field names and timestamps stay as they are.

## Design

- **Tier 2, `runtime: transform`.** No command, no network, no model: the pasted text never
  leaves the launcher. That is the point of a scrubber, and it keeps the app gallery-eligible.
- **Deterministic.** 15 `replace` steps, ordered most specific first (a JWT inside an
  `access_token` stays labelled `[REDACTED_JWT]` instead of a generic `[REDACTED]`).
- **Close to `redact_secrets`.** The schema reserves a `redact_secrets` step that does not run
  yet. This app is what that step could do today with shipped steps, and its tests could serve as
  conformance cases when the built-in step lands.
- No lookarounds and no nested repeats, so the patterns should work in both JS and RE2/Rust
  regex dialects. I have not confirmed which dialect Bolt uses.

## Limits

It masks known shapes. An unlabelled random string (`x=Zq81...`) cannot be told apart from an
ID, and the app does not try to: masking too much would make the paste useless for debugging.
Review the output before you share it.

## Permissions

- `reads_launcher_input`
- `copies_to_clipboard`

## Tests

6 transform tests in `bolt-app.json` (curl, JSON error, `.env`, raw HTTP, private key, and a
no-secret log that must come back unchanged). Run them offline:

```
node tools/transform-test.mjs apps/share-safe --bolt-apps <path to bolt-apps clone>
```
