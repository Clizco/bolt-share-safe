# Notes from building a Bolt App

These notes come from building `share-safe` (`=scrub`) as an outside author. I used bolt-apps at
commit `6bc0615` (2026-11-17), the docs at sparcle.app/docs/extend, and Node 24 and Python 3.12 on
Windows 11.

## 1. Transform tests cannot be run before installing (biggest gap)

`lint` checks the shape of tests, and the README says Bolt runs them when you add the app. For a
tier 2 author, that means the only way to learn that an `expect` is wrong is to pack, drop the pack
on Bolt, review, accept, and reinstall with a higher `--version` each time. Script apps get
`check` with goldens, but transform apps, which are the only apps the gallery accepts, get no
equivalent.

**What I built:** `tools/transform-test.mjs`, a runner of about 120 lines. It reuses the
toolkit's own `yamlsubset.mjs` and executes the line and regex steps (`lines trim upper lower
title sort reverse dedupe replace filter prefix suffix template head tail split join`). It
reports `table`, `markdown` and other steps it does not model as SKIP, never as PASS. It passes
both of Sparcle's `unique-errors` tests unchanged, and it skips the two `csv-to-markdown` tests
honestly.

**Suggestion:** expose Bolt's real transform engine as `bolt-apps test`, as WASM or a Node build of
the same code. A community runner like mine can drift from Bolt's behaviour, and
`verify-cases.json` already shows the conformance pattern this would follow.

## 2. The install prompt can claim curl or wget in an app that runs nothing

My first `description` said "paste a log, API response, curl command...". `verify` then warned
`script_mentions`: *the install prompt will list: curl or wget with an address not written out
here*. The app is a pure `transform` with no command or network access. The heuristic
(`assess.mjs:258`) scans prose fields such as `description` and `placeholder_examples` as if they
were commands.

For a security product, a false "this app may run curl" on the install card is costly. It trains
people to click through warnings, and it scares them away from safe apps. **Suggestion:** for
`runtime: transform`, skip the command-mention scan on display-only fields, or label it "mentioned
in text" rather than listing it as something the app can do.

## 3. `redact_secrets` is reserved but has no shipped behaviour or spec

The schema lists `redact_secrets` (and `sanitize`), but the docs say it is not running yet.
`share-safe` shows what the step could cover today using 15 `replace` steps. Its tests could seed
the step's conformance cases. A built-in step would also let Bolt keep one central list of token
shapes instead of every app copying regexes.

## 4. Smaller things

- **The regex dialect is not stated.** The docs ban nested repeats and cap regexes at 512
  characters, but they never say whether Bolt runs JS `RegExp`, Rust `regex` or RE2. That decides
  whether `$1` or `${1}` is the right replacement syntax, and whether lookarounds work. I avoided
  lookarounds to be safe.
- **`recognize` match semantics.** In `cve-lookup`, `"see CVE-2024-3094 for details"` is a
  *negative* sample, so recognize seems to need a whole-input match. Then a scrubber cannot offer
  itself when someone pastes a 200-line log that contains a bearer token. That is exactly when it
  would help most. An `ambient` and "contains" mode for tier 2 apps would make this kind of safety
  app proactive.
- **The scaffold author is the OS username.** `bolt-apps new` wrote `"author": {"name": "HP"}`,
  my Windows account name, and no `link`. A placeholder that makes lint fail would be safer than
  silently leaking a machine username into a pack.
- **README versus repo settings.** The README says "Talk in GitHub Discussions", but the API
  returns `410 Discussions are disabled for this repo`.
- **Docs inconsistency.** The User Apps page says `schema_version: 1`, while the agent guide
  allows `1` or `2`. The bridge timeout default (10 s) appears only in the agent guide.

## What I verified and what I did not

- Verified: `bolt-apps lint`, `verify` on the folder, `pack`, and `verify` on the `.boltpack`
  all pass. All 6 tests pass in my runner.
- **Not yet verified:** running the app inside Bolt itself. *(Update this line after installing
  Bolt and trying `=scrub` in the launcher.)*
