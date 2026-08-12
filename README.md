# flight-offer — fare aggregation records (etzhayyim substrate)

`flight-offer` is a Skyscanner-equivalent **fare aggregator**: it records flight
offers observed from providers, lets a DID watch a route+date against a price
threshold, and records an alert when the cheapest fare crosses it.

It does **not** sell or book tickets. There is no money-transmission surface
here at all — no merchant of record, no settlement, no PSP. Fares are public
open-data and a watch is a DID-keyed route subscription (origin, destination,
date, threshold), so this repo carries no payment liability and no sensitive
PII. That is the `axis-clean` posture of ADR-2605172400, and it is the single
most load-bearing fact about the repo: if you find yourself adding a booking
call, you are in the wrong repo (booking is `air-book` or the provider).

- **Identity**: `did:web:flight-offer.etzhayyim.com`, nanoid `fl1ghts1`
- **Substrate posture**: ADR-2605172000 — AT Protocol PDS records. No
  RisingWave, no SQL, no fiat processor.
- **Function split**: ADR-2606011400
- **Collections**: `com.etzhayyim.apps.flightOffer.{offer,watch,alert}`

## Read this before `CLAUDE.md`: two architectures live in this repo

`CLAUDE.md`, `appview/`, and `kotodama.jsonld` describe a **RisingWave +
LangServer + BPMN** implementation — `vertex_flight_offer` tables, twelve
LangServer primitives, twelve BPMN files, a `pollWatchlist` R/PT6H timer, a
zeebe cluster. **None of that is in this repo, and none of it is the
substrate of record.** It describes the pre-migration system that lived in
`etzhayyim/root`, and the files that reference it came across verbatim with
the seed.

The substrate of record is `kotoba/`, which is AT PDS records and nothing else.
The two do not even agree on the API: `CLAUDE.md` documents an XRPC surface of
`searchOffers` / `checkPriceDrop` / `addWatch` / `pollWatchlist` / `listSources`
/ `sourceHealth`; `kotoba/` exports `recordOffer` / `getCheapestFare` /
`createWatch` / `fireAlert` / `coverage`. They are different systems with the
same name. See [ADR-0001](docs/adr/0001-kotoba-is-the-substrate-of-record.md).

The `appview/` Worker is not a counter-example. Its XRPC route is a blind proxy
that forwards any NSID to `mcp.etzhayyim.com` as an MCP `tools/call` — it
contains no domain logic, imports nothing from `kotoba/`, and depends on two
`workspace:*` packages (`@etzhayyim/kotodama-host-sdk`, `@etzhayyim/xrpc`) that
have no workspace here to resolve against. It cannot be built from this repo.

## Status: the record layer runs; nothing has been deployed

`kotoba/` installs, typechecks, and its four test cases pass — see
[`docs/operator-quickstart.md`](docs/operator-quickstart.md), which was walked
end to end rather than written from the package scripts. What that green run
does *not* mean:

- nothing here has been executed against a real PDS
- `did:web:flight-offer.etzhayyim.com` has not been shown to resolve
- the `com.etzhayyim.apps.flightOffer.*` collections have not been shown to be
  registered in any Lexicon
- **no provider is wired.** `Provider` is a string union
  (`amadeus | duffel | kiwi | sabre | other`) validated on input. There is no
  Amadeus client, no Duffel client, and no polling loop in this repo — the
  thing that would actually observe a fare does not exist here. `recordOffer`
  is the seam a poller would call.
- the Charter §2(a)-(h) review in `MIGRATION-TODO.md` is still open

## What is in here

```
kotoba/src/
  types.ts     record shapes, DID/rkey derivation, validators, ltMicros
  registry.ts  the ten operations + the paginating scanAll helper
  index.ts     barrel
kotoba/test/
  flight-offer.test.ts   4 vitest cases against an in-memory PDS mock
appview/etzhayyim-wasm-flight-offer-fl1ghts1/
  src/app.ts   a self-contained embed page (dark, hand-written CSS)
  svelte/      SvelteKit BFF; xrpc/[...path] proxies to the MCP router
  wrangler.jsonc  route fl1ghts1.etzhayyim.com/*
```

Identity hierarchy, from `types.ts`:

```
did:web:flight-offer.etzhayyim.com                  controller
did:web:flight-offer.etzhayyim.com:offer:{offerId}  a fare observation
did:web:flight-offer.etzhayyim.com:watch:{watchId}  a route subscription
did:web:flight-offer.etzhayyim.com:alert:{alertId}  a threshold crossing
```

Prices are **decimal strings in micros**, because AT Lexicon has no float type
and a fare must not round. `ltMicros` compares them by length first and only
then lexicographically, which is what makes `"120000000000" > "72000000000"`
come out right; plain `<` would call the twelve-digit number the cheaper one.
That is not hypothetical — it is the mutation that turns the suite red, in
§3 of the quickstart.

## Invariants the code actually enforces

| Invariant | Where | Tested |
|---|---|---|
| IATA codes are 3 letters, carrier 2 alphanumerics, currency 3 letters | `types.ts` | yes (carrier: no) |
| Origin may not equal destination | `registry.ts` | yes |
| Prices and thresholds are `^\d+$` — `"12.5"` is rejected, not truncated | `types.ts` | yes |
| Provider must be in the closed set | `types.ts` | yes |
| Currency and IATA codes are upper-cased on write, so `"jpy"` stores as `"JPY"` | `registry.ts` | yes |
| Cheapest-fare comparison is numeric, not lexicographic | `types.ts` | yes |
| A watcher DID must start with `did:` | `registry.ts` | yes |
| An alert may not reference a watch that does not exist | `registry.ts` | yes |
| Cancelling an already-cancelled watch is rejected, not a no-op | `registry.ts` | yes |
| `recordOffer` / `createWatch` / `fireAlert` are idempotent on their id | `registry.ts` | **no** |
| `getOffer` / `cancelWatch` on a missing id return `notFound` | `registry.ts` | **no** |

The last two rows are branches that exist and behave correctly when probed by
hand, but no test asserts them, so nothing stops a future edit from removing
them. If you are looking for the smallest useful contribution to this repo,
it is those two rows.

## Known gap: the list operations filter *after* paging

`listOffers`, `listWatches`, and `listAlerts` read **one page** and then apply
the caller's filters to that page. A route filter therefore returns nothing at
all once the collection outgrows a page, and the reported `total` is the size
of the filtered page — not a total.

Measured, with 60 `HND→SIN` offers written before 5 `CTS→FUK` offers:

```
listOffers({originIata:"CTS", destIata:"FUK"})              → total 0
listOffers({originIata:"CTS", destIata:"FUK", limit:200})   → total 5
getCheapestFare({originIata:"CTS", destIata:"FUK"})         → offerCount 5
```

`getCheapestFare` and `coverage` are correct here, because they go through
`scanAll`, which follows the cursor. The three list operations do not. The four
test cases never write more than three records, so the suite cannot see this.

A fix has to decide something the code currently ducks: whether these are
cursor-paginated views (in which case `total` should be dropped, since a page
cannot know a total) or filtered queries (in which case they need `scanAll` and
a real cap). Recording it here rather than guessing.

## Known gap: an offer is immutable once recorded

`recordOffer` checks for an existing record *after* validating, so a second
call with the same `offerId` and a different price returns `alreadyExists` and
**keeps the first price**. Verified: recording `O-1` at `85000000000` and then
again at `42000000000` leaves `85000000000` stored.

That is defensible — an offer is an observation at a point in time, and
`observedAt` is part of the record — but it means the poller that does not
exist yet must mint a fresh `offerId` per observation. If it reuses a
provider-supplied id, prices will silently stop updating.

## Naming

`README.edn` calls this `com-etzhayyim-app-flight-offer` and `migration.edn`
names `etzhayyim/com-etzhayyim-app-flight-offer` as the destination. The repo
actually lives at `cloud-itonami/flight-offer`. Those EDN files record where
the seed came from and are left as they are: identity is the path
`<org>/<name>`, not the string in the seed metadata.

## Reference

- [`docs/operator-quickstart.md`](docs/operator-quickstart.md) — install,
  typecheck, test, and how to prove the tests can fail
- [`docs/adr/0001-kotoba-is-the-substrate-of-record.md`](docs/adr/0001-kotoba-is-the-substrate-of-record.md)
- `MIGRATION-TODO.md` — the Charter §2(a)-(h) checklist, still open
- `CLAUDE.md` — the retired RisingWave/LangServer design; historical
- `migration.edn` — provenance of the seed (`etzhayyim/root` @ `f9432ab5`)
