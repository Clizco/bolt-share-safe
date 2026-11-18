# share-safe: a Bolt App that scrubs secrets before you share

A small extension for [Bolt](https://sparcle.app/bolt/), plus an offline test runner and notes from
building it as an outside author.

## What's here

| Path | What it is |
|---|---|
| [`apps/share-safe/`](apps/share-safe/) | `=scrub`: paste a log, HTTP exchange, JSON response or `.env` and copy it back with tokens, keys, cookies, passwords and emails masked. Tier 2 (`runtime: transform`): no command, no network, no model. |
| [`tools/transform-test.mjs`](tools/transform-test.mjs) | Runs the `transform` tests in a `bolt-app.json` offline. The official toolkit checks the shape of these tests but does not run them. |
| [`FINDINGS.md`](FINDINGS.md) | What I found while building it: gaps in the toolkit, a false alarm on the install prompt, and doc inconsistencies. |

## Example

```
GET /v1/me HTTP/1.1
Authorization: Bearer eyJhbGciOi...
Cookie: session=7f3a9c
{"status": 401, "error": "TOKEN_EXPIRED", "user": "asha@example.com", "password": "hunter2"}
```

becomes

```
GET /v1/me HTTP/1.1
Authorization: Bearer [REDACTED]
Cookie: [REDACTED]
{"status": 401, "error": "TOKEN_EXPIRED", "user": "[EMAIL]", "password": "[REDACTED]"}
```

## Try it

**In Bolt:** go to Settings → Desktop App → User Apps → Open folder, copy
`apps/share-safe/utilities/scrub.yaml` into that folder, click Reload, then type `=scrub` in the
launcher.

**Run the tests** (Node 18 or newer, plus a clone of
[SparcleHQ/bolt-apps](https://github.com/SparcleHQ/bolt-apps); the runner reuses its YAML reader):

```bash
git clone --depth 1 https://github.com/SparcleHQ/bolt-apps
node tools/transform-test.mjs apps/share-safe --bolt-apps bolt-apps
```

**Lint and pack** with the official toolkit:

```bash
node bolt-apps/toolkit/bin/bolt-apps.mjs lint apps/share-safe
node bolt-apps/toolkit/bin/bolt-apps.mjs verify apps/share-safe
```
