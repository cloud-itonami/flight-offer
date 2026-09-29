# 60-apps/etzhayyim-project-flight-offer

Skyscanner-equivalent flight fare aggregation actor. **P1–P8 shipped 2026-04-28.**
All compute lives in LangServer BPMN-contract (`etzhayyim-root/00-contracts/bpmn/com/etzhayyim/flight-offer/`) +
LangServer primitives (`40-engine/kotoba/crates/kotoba-kotodama/py/src/kotodama/ingest/flight_offer.py`).
The CF Worker in `appview/` is a thin presentation layer.

| Layer | Where |
|---|---|
| **State** | `vertex_flight_offer` · `mv_flight_offer_cheapest_by_route_date` · `vertex_flight_offer_alert` · `vertex_flight_offer_watch` · `vertex_airline` · `vertex_flight_offer_source` · `edge_flight_offer_source_covers_airline` · `mv_flight_offer_source_coverage` · `vertex_flight_offer_source_run` · `mv_flight_offer_source_health` |
| **Logic** | 12 LangServer primitives `flight.offer.{fetch,fetchFromSource,checkDrop,addWatch,removeWatch,listWatch,getCheapest,pollWatchlist,listSources,listAirlines,sourceHealth,cleanupRuns}` |
| **Orchestration** | 12 BPMNs under `etzhayyim-root/00-contracts/bpmn/com/etzhayyim/flight-offer/`, dispatched via `vertex_bpmn_lexicon_binding` (ADR-0056) |
| **Schedules** | `pollWatchlist.bpmn` R/PT6H · `cleanupRuns.bpmn` R/PT24H (90d retention) |
| **Fan-out** | `checkPriceDrop.bpmn` exclusiveGateway → `generic.pds.dispatch(app.bsky.feed.post)` when `alerted=true` |
| **Providers** | registry-driven: `amadeus` / `duffel` / `kiwi-tequila` / `travelpayouts-aviasales` / `stub` (env-gated) |
| **Registry** | 42 IATA airlines (`vertex_airline`) · 8 sources (`vertex_flight_offer_source`) · N:M coverage (`edge_flight_offer_source_covers_airline`) |
| **Identity** | `did:web:flight-offer.etzhayyim.com`, nanoid `fl1ghts1` |

## XRPC surface (`com.etzhayyim.apps.flightOffer.*`)

| NSID | Summary |
|---|---|
| `searchOffers` | ad-hoc fetch + persist for a route/date |
| `getCheapest` | MV lookup — single cheapest row |
| `checkPriceDrop` | drop check with optional AT post fan-out |
| `addWatch` | upsert watchlist row |
| `removeWatch` | archive (default) or hard-delete |
| `listWatch` | enumerate watchlist (status filter) |
| `pollWatchlist` | iterate due rows, multi-source refresh + drop check (also R/PT6H timer) |
| `fetchFromSource` | single-source fetch by source_id |
| `listSources` | enumerate `vertex_flight_offer_source` |
| `listAirlines` | enumerate `vertex_airline` with coverage counts |
| `sourceHealth` | `mv_flight_offer_source_health` — per-source success rate / latency / last OK |
| `cleanupRuns` | delete `vertex_flight_offer_source_run` rows older than retentionDays (default 90) |

## Deployment status (2026-04-28)

| Item | Status |
|---|---|
| 13 graph migrations | ✅ applied to RisingWave |
| database.ts regenerated | ✅ |
| CF Worker build | ✅ (template literal fix + flight-offer.etzhayyim.com route) |
| CF Worker deploy | ❌ pending `wrangler login` (CF auth expired) |
| LangServer task activation | ❌ pending `kubectl rollout restart deployment/langserver-worker -n zeebe` |
| Amadeus/Duffel credentials | ❌ pending provisioning |

### Manual steps to complete P8

```bash
# 1. Refresh CF auth and redeploy Worker
wrangler login
cd 60-apps/etzhayyim-project-flight-offer/appview/etzhayyim-wasm-flight-offer-fl1ghts1
etzhayyim deploy

# 2. Restart langserver-worker to load new LangServer task types
kubectl rollout restart deployment/langserver-worker -n zeebe

# 3. Provision API credentials (Amadeus example)
security add-generic-password -s etzhayyim.flightoffer -a AMADEUS_CLIENT_ID -w '...' -U
security add-generic-password -s etzhayyim.flightoffer -a AMADEUS_CLIENT_SECRET -w '...' -U
# Inject into Vultr K8s zeebe pod env per etzhayyim-root/50-infra/vultr/zeebe/ runbook
```

## Adding a new source adapter

1. Add `_adapter_XXX()` in `flight_offer.py`
2. Register in `_SOURCE_ADAPTERS` dict + `_SOURCE_ENV_REQ`
3. INSERT 1 row into `vertex_flight_offer_source` (migration)
4. INSERT coverage edges into `edge_flight_offer_source_covers_airline`

## What this project does NOT contain

- No domain logic in the CF Worker — per ADR-0056, all logic is in BPMN/LangServer.
- No project-specific secrets in `wrangler.jsonc` — uses platform shared secrets store.
