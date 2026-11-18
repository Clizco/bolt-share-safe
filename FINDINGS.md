# Notes from building a Bolt App

I built `share-safe` (`=scrub`) as an outside author and ran it in **Bolt 0.1.181 on Windows 11**,
installed with `winget`. I used bolt-apps at commit `6bc0615` (2026-11-17) and the docs at
sparcle.app/docs/extend. Every result below that came from running Bolt was checked by reading the
clipboard after Bolt copied it.

![Demo](docs/demo.gif)

## 1. Paste-Guard leaves passwords and cookies in pasted blocks (verified in Bolt)

When you paste a multi-line block into the launcher, Bolt's built-in **Paste-Guard** offers
"Redact and copy". I pasted the same samples that `=scrub` is tested on:

| Pasted block | Paste-Guard (built in) | `=scrub` |
|---|---|---|
| JSON error with `"user"`, `"access_token"` (a JWT) and `"password": "hunter2"` | Masks the email and the JWT. **Copies `"password": "hunter2"` unchanged.** | `[EMAIL]`, `[REDACTED_JWT]`, `"password": "[REDACTED]"` |
| Raw HTTP exchange with `Cookie: session=...` and `Set-Cookie: session=...` | **Not offered at all.** The block is treated as plain code. | `Cookie: [REDACTED]`, `Set-Cookie: [REDACTED]` |
| `.env` with AWS, GitHub and Stripe keys and `postgres://acme:s3cr3t@db...` | Masks all of them. The URL comes out as `••••••db.example.com`: the `@` is gone, so the user name and the host run together. | Same coverage. The URL comes out as `postgres://[REDACTED]@db.example.com`, which keeps its shape. |

The first two rows show that Paste-Guard decides from token shapes (a JWT, an email address, a
known key prefix). It never looks at what a key is called. A plain `password`, `secret` or session
cookie has no recognisable shape, so it gets through. This matters most in API debugging pastes,
which is where those values usually show up.

**Suggestion:** add key-name rules (`password`, `secret`, `*_token`, and `Cookie` /
`Set-Cookie` / `Authorization` headers) to Paste-Guard, and keep the `@` when masking URL
credentials. `=scrub`'s 15 rules and 7 tests are a ready-made list of cases for this.

## 2. Without `recognize`, a transform app is never offered for a pasted block (verified in Bolt)

`=scrub` plus a one-line paste works as the docs describe. But a multi-line paste turns the
launcher input into a **block**, and the `=scrub` chip is dropped. The bundled `=scrub-pii` app
behaves the same way, so this is not specific to my app. A block can only reach a transform app
through **Convert → <app>**, and that entry appears only when the app's `recognize` patterns
match the block. The User Apps docs present `recognize` as optional ("claims pasted text without
`=`"), but for any app meant for logs or responses, which are almost always multi-line, it is
effectively required.

I added an `ambient` recognize block with 8 patterns and a recognizer test. After that, Bolt offers
"Scrub secrets before sharing" under Convert for the JSON, HTTP and `.env` blocks above. The
outputs in the table come from that path.

**Suggestion:** say this in the docs and in the transform template (`bolt-apps new --type
transform`). Or keep the `=chip` when the paste that follows it is multi-line.

## 3. Transform tests cannot be run before installing

`lint` checks the shape of tests, and the README says "Bolt runs them". For a tier 2 author, the
loop is therefore: edit, copy the file, Reload, approve again (a changed file needs a new
approval), then paste by hand. Script apps get `check` with goldens, but transform apps, which are
the only apps the gallery accepts, get no equivalent.

**What I built:** `tools/transform-test.mjs`, a runner of about 140 lines.
- It reuses the toolkit's own `yamlsubset.mjs`.
- It executes the line and regex steps (`lines trim upper lower title sort reverse dedupe replace
  filter prefix suffix template head tail split join`) and runs `recognizer` tests.
- It reports `table`, `markdown` and other steps it does not model as SKIP, never as PASS.
- It passes Sparcle's `unique-errors` tests unchanged.
- All 7 `=scrub` results it predicts matched what Bolt produced for the cases I ran there.

**Suggestion:** a `bolt-apps test` built on the real `pipe.ts` engine, which the bundled
`redact.yaml` names as the engine. A community runner can drift from Bolt's behaviour.

## 4. Install and approval text overstates what a transform app can do (verified in Bolt)

- **In `bolt-apps verify`:** a `description` containing the word "curl" made `verify` warn that
  *the install prompt will list: curl or wget with an address not written out here*. The heuristic
  (`assess.mjs:258`) scans prose fields as if they were commands.
- **In Bolt itself:** a pure `runtime: transform` app is shown as *"Runs with your permissions. Not
  sandboxed."* The approval dialog then says *"It can read and change your files and use your
  accounts the way you can."* Neither is true for a transform, which has no command and no
  network.

For a security product, warnings that are always on teach people to click through them.
**Suggestion:** word the card by runtime. For a transform, say "Only reshapes text you paste. No
commands, no network."

## 5. Smaller things

- **macOS wording on Windows.** The folder step of onboarding says *"macOS will ask once for each
  folder"*. The Window settings describe the "Dock" and the "cmd-tab switcher". The profile menu
  says *"What has asked to pair with this Mac"*.
- **The scaffold author is the OS username.** `bolt-apps new` wrote `"author": {"name": "HP"}`,
  my Windows account name. A placeholder that makes lint fail would be safer.
- **README versus repo settings.** The README says "Talk in GitHub Discussions", but the API
  returns `410 Discussions are disabled for this repo`.
- **Docs inconsistency.** The User Apps page says `schema_version: 1`, while the agent guide
  allows `1` or `2`.
- **The regex dialect is in a comment, not in the docs.** The only place that says patterns are
  JavaScript regex is a comment in the bundled `redact.yaml`, which runs them through
  `pipe.ts`. The extend docs never say.

## Withdrawn

In an earlier draft I guessed that `recognize` needs the whole input to match. That was wrong:
ambient patterns match inside a block, as `=scrub-pii` and now `=scrub` show.

## Overlap I checked

Bolt already ships `=scrub-pii` (SSNs and emails) and `=redact` (company IDs, internal hosts and
IPs, with example patterns). `redact.yaml` says secrets are left to *"Bolt's built-in secret
masking"*, which is Paste-Guard. `=scrub` covers the secrets Paste-Guard misses (row 1 of the
table above) and keeps a labelled, readable output for tickets and chat.

## What I verified and what I did not

- **Verified in Bolt 0.1.181 (Windows):**
  - `=scrub` loads from `user-utils`.
  - It needs a new approval after every change to the file.
  - It transforms a one-line paste: test 1, exact match.
  - It is offered under Convert for blocks, and produces exactly the expected output for tests 2
    (JSON) and 4 (HTTP cookies).
- **Verified offline:** lint, verify, pack, and all 7 tests in my runner.
- **Not verified in Bolt:** tests 3, 5 and 6 through `=scrub` itself. I ran the `.env` sample
  through Paste-Guard only.
- **Skipped on purpose:** I did not install Bolt's localhost root certificate or index any
  folders, and I did not sign in to anything. None of that is needed for User Apps.
