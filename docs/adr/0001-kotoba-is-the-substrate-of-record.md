# ADR-0001 — `kotoba/` is the substrate of record; the RisingWave design is historical

**Status**: accepted
**Date**: 2026-08-13

## Context

This repo describes itself twice, and the two descriptions are incompatible.

**Description A — RisingWave + LangServer + BPMN.** Held by `CLAUDE.md`,
`kotodama.jsonld`, `appview/.../package.json`, and `wrangler.jsonc`. It names
ten `vertex_*` / `mv_*` / `edge_*` relations, twelve LangServer primitives
(`flight.offer.{fetch,fetchFromSource,checkDrop,addWatch,removeWatch,listWatch,getCheapest,pollWatchlist,listSources,listAirlines,sourceHealth,cleanupRuns}`),
twelve BPMN files under `etzhayyim/root:00-contracts/bpmn/`, an `R/PT6H` poll
timer, a `zeebe` namespace to `kubectl rollout restart`, and a registry of 42
IATA airlines across 8 sources. `CLAUDE.md` carries a deployment table dated
2026-04-28 whose last three rows are `❌ pending`.

**Description B — AT Protocol PDS records.** Held by `kotoba/`. Three
collections, ten exported functions, one dependency (`@etzhayyim/sdk`), no
database. Its module docstrings cite ADR-2605172000 (substrate posture) and
ADR-2606011400 (function split), and its own header says "AT PDS records
(no RW)".

They do not overlap. The API names differ, the storage differs, the
orchestration differs. A reader arriving at this repo cold cannot tell from the
file layout which one to extend, and `CLAUDE.md` — the file an agent reads
first — is the one describing the system that is not here.

Description A is not merely stale, it is **excluded by accepted policy**:
ADR-2605172000 puts the substrate at AT PDS + IPFS + Base L2, which leaves no
room for RisingWave. `MIGRATION-TODO.md` already lists "Strip RisingWave /
Postgres / Kysely / centralized DB code" as an open remediation item. So the
question this ADR settles is not *which substrate is correct* — that was
settled elsewhere — but *which files in this repo are load-bearing*, which no
document currently answers.

The `appview/` Worker looks like it might arbitrate, and does not. Its
`xrpc/[...path]` route forwards any NSID to `mcp.etzhayyim.com` as an MCP
`tools/call` without inspecting it, so it is compatible with both descriptions
and evidence for neither. It also cannot be built here: it depends on
`@etzhayyim/kotodama-host-sdk` and `@etzhayyim/xrpc` at `workspace:*`, and the
extraction from `etzhayyim/root` left the workspace behind.

## Decision

1. **`kotoba/` is the substrate of record.** New work on flight-offer's domain
   logic goes there, against AT PDS records.
2. **Description A is historical.** Do not implement against `vertex_*`
   relations, LangServer primitives, or the BPMN contracts. Do not treat the
   `CLAUDE.md` deployment table's `❌ pending` rows as a work queue — they are
   pending steps for a system this repo does not contain.
3. **`CLAUDE.md`, `kotodama.jsonld`, `appview/`, and `migration.edn` stay as
   they are.** They are provenance. Rewriting them would erase the record of
   what this app was before the migration, and `MIGRATION-TODO.md` still needs
   that record to close the Charter §2(a)-(h) review. `README.md` carries the
   pointer instead, and is what a reader hits first.
4. **The appview is out of scope until its workspace dependencies are
   resolved.** Either vendor `@etzhayyim/kotodama-host-sdk` and
   `@etzhayyim/xrpc` as git dependencies the way `kotoba/` vendors
   `@etzhayyim/sdk`, or drop `appview/` and let the MCP router own the surface.
   That is a real choice and this ADR does not make it.

## Consequences

- A reader who follows `CLAUDE.md` will now find `README.md` first and be told
  it is historical. Before this ADR the two files were equally authoritative
  and `CLAUDE.md` was the one an agent loads automatically.
- The twelve-primitive XRPC surface in `CLAUDE.md` is **wider** than the ten
  functions in `kotoba/`. Four of its capabilities have no counterpart:
  multi-source fetch (`fetchFromSource`), the source registry (`listSources`,
  `listAirlines`, `sourceHealth`), the poll loop (`pollWatchlist`), and run
  retention (`cleanupRuns`). Declaring A historical does not implement those —
  it makes their absence visible instead of leaving them apparently shipped.
- `kotodama.jsonld` will keep advertising `vertex_flight_offer` in its
  `convoSystemPrompt` to any agent that reads it. That is a live inconsistency
  and this ADR accepts it rather than editing a provenance file; whoever wires
  the actor for real has to fix it there and should cite this ADR when they do.

## Alternatives considered

**Delete `appview/` and the RisingWave text now.** Rejected: the Charter review
in `MIGRATION-TODO.md` is open, and it is a review of *what was copied in*.
Deleting the evidence before the review would make the review unanswerable.

**Rewrite `CLAUDE.md` to describe `kotoba/`.** Rejected for this iteration on
scope, not on principle — it is the right end state, but doing it in the same
change that first names the discrepancy would leave no artifact showing that
the discrepancy existed. A follow-up may do it, citing this ADR.
