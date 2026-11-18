# Scrub secrets before sharing (`=scrub`)

Paste a log, HTTP exchange, JSON API response or `.env` and copy the same text back with
credentials and personal data masked. Everything else is untouched, so the paste still explains the
bug.

- **One line:** type `=scrub`, add a space, paste, then press Enter.
- **A block:** just paste it. Bolt offers **Convert → Scrub secrets before sharing** when the block
  contains something to mask, through the app's `recognize` patterns.

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
- **Built for what Paste-Guard misses.** Bolt's built-in Paste-Guard masks values by their token
  shape, but in Bolt 0.1.181 it leaves `"password": "..."` and `Cookie:` headers alone. `=scrub`
  also masks by key name. See [FINDINGS.md](../../FINDINGS.md).
- Patterns are JavaScript regex, the dialect Bolt's transform engine uses. They contain no nested
  repeats.

## Limits

It masks known shapes. An unlabelled random string (`x=Zq81...`) cannot be told apart from an
ID, and the app does not try to: masking too much would make the paste useless for debugging.
Review the output before you share it.

## Permissions

- `reads_launcher_input`
- `copies_to_clipboard`

## Tests

`bolt-app.json` has 6 transform tests: curl, JSON error, `.env`, raw HTTP, private key, and a
no-secret log that must come back unchanged. It also has 1 recognizer test, which checks the app
is offered on blocks with secrets and not on plain logs.

In Bolt 0.1.181 I checked tests 1, 2 and 4 by hand, and Bolt's output matched exactly. Run all of
them offline:

```
node tools/transform-test.mjs apps/share-safe --bolt-apps <path to bolt-apps clone>
```
