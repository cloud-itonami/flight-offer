# Operator quickstart

Every command below was executed on 2026-08-13 against commit `6a58887`, with
no changes to the repo other than the ones this document tells you to make and
undo. Output is transcribed, not paraphrased. If a step does not reproduce for
you, that is a bug in this document — fix it here rather than working around it
in silence.

Environment used: macOS (darwin 25.3.0), Node v26.3.0, npm 11.16.0.

Only `kotoba/` is buildable. `appview/` depends on `@etzhayyim/kotodama-host-sdk`
and `@etzhayyim/xrpc` at `workspace:*` and the extraction from `etzhayyim/root`
left the workspace behind, so there is nothing for those specs to resolve
against. Do not start there.

## 0. Read this before you run `npm install`

On a machine whose **user** `~/.npmrc` contains an `allow-scripts[]` entry, a
plain install dies in about six seconds:

```console
$ cd kotoba && npm install
npm error code 1
npm error git dep preparation failed
npm error command …/npm-cli.js install --force --cache=… --no-audit …
npm error npm warn using --force Recommended protections disabled.
npm error npm error code EALLOWSCRIPTS
npm error npm error --allow-scripts is not allowed in project-scoped installs.
npm error npm error Add the entries to the "allowScripts" field in package.json, or to .npmrc, instead.
```

`@etzhayyim/sdk` is a git dependency that declares `"prepare": "tsc"`, so npm
must build it after cloning. It does that by **re-entering itself** with
`--force`. That nested install inherits the user config's `allow-scripts` as a
command-line flag, and npm 11.16.0 rejects `--allow-scripts` on a
project-scoped install. Nothing about this repo causes it.

The cause is the user config entry, not the npm version. Verified in the same
directory against the same cache, changing only `--userconfig`:

| `--userconfig` file contains | result |
|---|---|
| `strict-ssl=false` + `allow-scripts[]=@anthropic-ai/claude-code` | `EALLOWSCRIPTS`, fails in ~6s |
| `strict-ssl=false` alone | `added 135 packages in 11m`, exit 0 |

So the fix is to run the install with a user config that has no `allow-scripts`
entry. Do **not** delete the entry from your real `~/.npmrc` — something else
put it there. Point npm at a scratch file for this one command:

```console
$ printf 'strict-ssl=false\n' > /tmp/npmrc-clean
$ cd kotoba && npm install --no-audit --no-fund --userconfig=/tmp/npmrc-clean
```

The `strict-ssl=false` line is carried over from this machine's `~/.npmrc`
rather than shown to be necessary; drop it first and put it back only if the
install complains about certificates.

If your `~/.npmrc` has no `allow-scripts` entry, none of this applies — a
user config with no such entry is exactly what the successful run above used,
so plain `npm install` is the same command.

## 1. Install

```console
$ npm install --no-audit --no-fund --userconfig=/tmp/npmrc-clean

added 135 packages in 9m
npm warn allow-scripts 8 packages have install scripts not yet covered by allowScripts:
npm warn allow-scripts   @etzhayyim/sdk@0.1.0-alpha (prepare: tsc)
…
npm warn allow-scripts   @signalapp/libsignal-client@0.94.4 (install: echo Use `npm run build` …)
```

Minutes, not seconds, is normal: npm clones eight git dependencies and runs
`tsc` inside each one. Measured here — 9 minutes with a warm npm cache and no
lockfile; 4 minutes with an empty cache but a lockfile carried over; longest of
the three from a pristine `git archive` of `HEAD` with an empty cache and no
lockfile, which is the case a fresh reader is actually in. All three ended at
exit 0 with 135 packages (136 when `fsevents` came along), a clean
`tsc --noEmit`, and 4 passing tests.

Two things about that warning list are worth knowing, because both look like
failures and are not:

- The `prepare: tsc` lines describe the **outer** tree's lifecycle scripts,
  which npm declines to run. The builds you actually need already happened
  during git-dependency preparation — `node_modules/@etzhayyim/sdk/dist/`
  exists when the install finishes. Check it if you are unsure.
- `@signalapp/libsignal-client` is an optional native dependency of the SDK.
  Nothing in `flight-offer` imports it. Do not run `npm approve-scripts` to
  quiet it.

You do not need `overrides` here. `@etzhayyim/checkpointer` floats two of its
dependencies at `#main`:

```
"@etzhayyim/ipfs": "git+https://github.com/kotoba-lang/ipfs.git#main",
"@etzhayyim/pqh":  "git+https://github.com/kotoba-lang/pqh.git#main",
```

and `kotoba-lang/ipfs` now redirects to `kotoba-lang/io-ipfs`, a Clojure repo
whose `package.json` has no `name` field. That would break the closure — except
`@etzhayyim/sdk` SHA-pins both packages itself (`#671888e0…` and `#ab728717…`),
and npm resolves the whole tree to those pins. Confirm with:

```console
$ node -e 'const l=require("./node_modules/.package-lock.json");
  for (const [k,v] of Object.entries(l.packages))
    if (k.includes("etzhayyim")) console.log(k, "=>", v.resolved)'
node_modules/@etzhayyim/ipfs => git+ssh://git@github.com/kotoba-lang/ipfs.git#671888e08cc42b297c668b6124cf7c5b9d1676f0
node_modules/@etzhayyim/pqh  => git+ssh://git@github.com/kotoba-lang/pqh.git#ab728717804ec18dafee7262fa83352ffbc1aaf1
```

If either line ever shows a commit other than those two, the floating `#main`
won and the install is not the closure this document was written against.

`package-lock.json` is generated and **not committed**. Whether it should be is
a real question — committing it would pin the closure against exactly the drift
described above — but it is a substrate decision, not a documentation one, so
it is left open here.

The repo also has no `.gitignore`, so after this step `git status` shows
`kotoba/node_modules/` and `kotoba/package-lock.json` as untracked. That is
expected; do not commit either.

## 2. Typecheck

```console
$ npx tsc --noEmit
$ echo $?
0
```

Silence is the pass. `tsconfig.json` compiles `src/**/*.ts` under
`strict: true` against the SDK's real `.d.ts` files, so a green typecheck means
the git pins resolved *and* built — not merely that the local files parse.

Note that `tsconfig.json`'s `include` is `src/**/*.ts` only. The test file is
not typechecked by this command; vitest transpiles it without type checking.

## 3. Test

```console
$ npx vitest run

 RUN  v4.1.10 …/kotoba

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  422ms
```

The four cases, by name:

```
offers + cheapest-fare rollup > records, reads, lists by route, finds cheapest (string-micros compare)
offers + cheapest-fare rollup > rejects bad airport/price/provider/same-route
watches + alerts             > creates DID-keyed watch, cancels, lists; fires alert FK→watch
watches + alerts             > coverage rolls up the three collections
```

They run against `MockEtzhayyim`, an in-memory PDS. **No test reaches a real
PDS**, and there is nothing to configure wrong that would make one — the PDS is
a constructor argument.

## 4. Prove the tests can fail

A suite you have only watched pass is not evidence. Two mutations, each of
which should turn exactly one case red.

### 4a. The micros comparison

`ltMicros` compares decimal strings by length first. Drop that and it becomes
plain lexicographic, which calls a twelve-digit fare cheaper than an
eleven-digit one:

```console
$ perl -0pi -e 's/  if \(a\.length !== b\.length\) return a\.length < b\.length;\n//' src/types.ts
$ npx vitest run

 FAIL  test/flight-offer.test.ts > … > records, reads, lists by route, finds cheapest (string-micros compare)
AssertionError: expected 'O-3' to be 'O-2' // Object.is equality

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)

$ git checkout src/types.ts
```

`O-3` is the ¥120,000 fare and `O-2` the ¥72,000 one, so the mutation makes the
aggregator recommend the most expensive flight. Exactly one case catches it.

The comment on that assertion in the test file — `// 72bn < 85bn < 120bn (equal
length → lexicographic)` — is misleading: the *equal*-length pairs pass under
either implementation. What discriminates is `120000000000` vs `72000000000`,
which are different lengths.

### 4b. The alert→watch foreign key

`fireAlert` refuses to record an alert against a watch that does not exist.
Remove the guard:

```console
$ perl -0pi -e 's/  if \(!\(await exists\(e, WATCH_COLLECTION, watchRkey\(input\.watchId\)\)\)\) \{\n    return \{ status: "watchNotFound", error: `watchNotFound:\$\{input\.watchId\}` \};\n  \}\n//' src/registry.ts
$ npx vitest run

 FAIL  test/flight-offer.test.ts > … > creates DID-keyed watch, cancels, lists; fires alert FK→watch
AssertionError: expected 'fired' to be 'watchNotFound' // Object.is equality

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)

$ git checkout src/registry.ts
```

If either mutation leaves the suite green, stop — something is wrong with your
setup, and a green run tells you nothing until you have fixed it.

## 5. Probe the branches no test covers

Three behaviours exist in `registry.ts` and no assertion protects them. Drop
this in as `test/_scratch.test.ts`, run it, then delete it — it throws its
result because vitest swallows `console.log` in the default reporter:

```ts
import { describe, it, beforeEach } from "vitest";
import { MockEtzhayyim } from "@etzhayyim/sdk-mock";
import { recordOffer, getOffer, cancelWatch } from "../src/index.js";
const base = { originIata: "HND", destIata: "SIN", departureDate: "2026-09-01",
  currency: "JPY", provider: "amadeus" as const, observedAt: "2026-06-01T00:00:00Z" };
describe("scratch", () => {
  let e: any;
  beforeEach(() => { e = new MockEtzhayyim({ did: "did:web:flight-offer.etzhayyim.com" }); });
  it("probe", async () => {
    const a = await recordOffer(e, { offerId: "O-1", ...base, priceMicros: "85000000000" });
    const b = await recordOffer(e, { offerId: "O-1", ...base, priceMicros: "42000000000" });
    const after = await getOffer(e, { offerId: "O-1" });
    throw new Error(`first=${a.status} second=${b.status} stored=${after.offer?.priceMicros} `
      + `missing=${JSON.stringify(await getOffer(e, { offerId: "NOPE" }))} `
      + `ghost=${JSON.stringify(await cancelWatch(e, { watchId: "GHOST" }))}`);
  });
});
```

```
first=recorded second=alreadyExists stored=85000000000
missing={"error":"notFound"} ghost={"status":"notFound","error":"watchNotFound"}
```

`stored=85000000000` is the one to notice: re-recording an `offerId` with a new
price keeps the **old** price. An offer is immutable once written, so a poller
must mint a fresh `offerId` per observation.

## 6. Reproduce the pagination gap

`listOffers` / `listWatches` / `listAlerts` read one page and filter it, so a
route filter goes silent once the collection outgrows the page. Write 60 offers
on one route, then 5 on another, and ask for the second — same scratch-file
trick as §5:

```ts
import { describe, it, beforeEach } from "vitest";
import { MockEtzhayyim } from "@etzhayyim/sdk-mock";
import { recordOffer, listOffers, getCheapestFare } from "../src/index.js";
const base = { departureDate: "2026-09-01", currency: "JPY",
  provider: "amadeus" as const, observedAt: "2026-06-01T00:00:00Z" };
describe("scratch", () => {
  let e: any;
  beforeEach(() => { e = new MockEtzhayyim({ did: "did:web:flight-offer.etzhayyim.com" }); });
  it("probe", async () => {
    for (let i = 0; i < 60; i++)
      await recordOffer(e, { offerId: `NOISE-${i}`, originIata: "HND", destIata: "SIN",
        priceMicros: "80000000000", ...base });
    for (let i = 0; i < 5; i++)
      await recordOffer(e, { offerId: `TARGET-${i}`, originIata: "CTS", destIata: "FUK",
        priceMicros: "20000000000", ...base });
    const q = { originIata: "CTS", destIata: "FUK" };
    throw new Error(`default=${(await listOffers(e, q)).total} `
      + `limit200=${(await listOffers(e, { ...q, limit: 200 })).total} `
      + `cheapest=${JSON.stringify(await getCheapestFare(e, q).then(r =>
          ({ n: r.offerCount, id: r.cheapest?.offerId })))}`);
  });
});
```

```
default=0 limit200=5 cheapest={"n":5,"id":"TARGET-0"}
```

Five `CTS→FUK` offers exist. The default query reports zero of them.

`getCheapestFare` is right because it goes through `scanAll`, which follows the
cursor. The list operations do not. The committed suite never writes more than
three records, so it cannot see this. See the README's known-gaps section.

## 7. What you cannot verify from here

Nothing above touches a real PDS, and this repo contains no provider client at
all. Specifically **not** covered:

- that `did:web:flight-offer.etzhayyim.com` resolves
- that the `com.etzhayyim.apps.flightOffer.*` collections exist in a Lexicon
- that any fare was ever observed — there is no Amadeus or Duffel client and no
  poll loop here; `Provider` is a validated string, not an integration
- anything in `appview/`, which cannot be built (see §0)
- the Charter §2(a)-(h) review in `MIGRATION-TODO.md`, still open

A green run here means the record layer is internally consistent. It does not
mean this app has ever run.
