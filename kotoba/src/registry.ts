/**
 * flight-offer kotoba — offer + watch + alert registries + cheapest-fare rollup
 * + coverage. AT PDS records (no RW). Alerts FK-reference an existing watch.
 * Public fare data; no ticketing/settlement.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  ALERT_COLLECTION,
  OFFER_COLLECTION,
  PROVIDERS,
  WATCH_COLLECTION,
  alertDidFor,
  alertRkey,
  isAirportIata,
  isCarrierIata,
  isCurrency,
  isUintString,
  ltMicros,
  offerDidFor,
  offerRkey,
  watchDidFor,
  watchRkey,
  type AlertRecord,
  type AlertView,
  type CancelWatchInput,
  type CancelWatchOutput,
  type CoverageInput,
  type CoverageOutput,
  type CreateWatchInput,
  type CreateWatchOutput,
  type FireAlertInput,
  type FireAlertOutput,
  type GetCheapestFareInput,
  type GetCheapestFareOutput,
  type GetOfferInput,
  type GetOfferOutput,
  type ListAlertsInput,
  type ListAlertsOutput,
  type ListOffersInput,
  type ListOffersOutput,
  type ListWatchesInput,
  type ListWatchesOutput,
  type OfferRecord,
  type OfferView,
  type RecordOfferInput,
  type RecordOfferOutput,
  type WatchRecord,
  type WatchView,
} from "./types.js";

const PAGE_LIMIT = 100;
const DEFAULT_MAX_SCAN = 10_000;

async function exists(e: Etzhayyim, collection: string, rkey: string): Promise<boolean> {
  const resp = await e.read({ collection, rkey }).catch(() => ({ records: [] }));
  return Boolean(resp.records[0]?.value);
}

// ─── Offer ──────────────────────────────────────────────────────────

export async function recordOffer(e: Etzhayyim, input: RecordOfferInput): Promise<RecordOfferOutput> {
  if (!input.offerId || !input.departureDate || !input.observedAt) return { status: "rejected", error: "missingRequiredFields" };
  const origin = input.originIata?.toUpperCase();
  const dest = input.destIata?.toUpperCase();
  if (!isAirportIata(origin ?? "") || !isAirportIata(dest ?? "")) return { status: "rejected", error: "invalidAirportIata" };
  if (origin === dest) return { status: "rejected", error: "originEqualsDest" };
  if (!isUintString(input.priceMicros)) return { status: "rejected", error: "invalidPriceMicros" };
  if (!isCurrency((input.currency ?? "").toUpperCase())) return { status: "rejected", error: "invalidCurrency" };
  if (!PROVIDERS.has(input.provider)) return { status: "rejected", error: "invalidProvider" };
  if (input.carrierIata && !isCarrierIata(input.carrierIata.toUpperCase())) return { status: "rejected", error: "invalidCarrierIata" };
  const rkey = offerRkey(input.offerId);
  const existing = await e.read<OfferRecord>({ collection: OFFER_COLLECTION, rkey }).catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { status: "alreadyExists", offerUri: existing.records[0].uri, did: existing.records[0].value.did, offerId: input.offerId };
  }
  const did = offerDidFor(input.offerId);
  const record: OfferRecord = {
    did,
    offerId: input.offerId,
    originIata: origin!,
    destIata: dest!,
    departureDate: input.departureDate,
    returnDate: input.returnDate,
    carrierIata: input.carrierIata?.toUpperCase(),
    priceMicros: input.priceMicros,
    currency: input.currency.toUpperCase(),
    provider: input.provider,
    observedAt: input.observedAt,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({ collection: OFFER_COLLECTION, record: record as unknown as Record<string, unknown>, rkey });
  return { status: "recorded", offerUri: receipt.uri, did, offerId: input.offerId };
}

export async function getOffer(e: Etzhayyim, input: GetOfferInput): Promise<GetOfferOutput> {
  if (!input.offerId) return { error: "invalidOfferId" };
  const resp = await e.read<OfferRecord>({ collection: OFFER_COLLECTION, rkey: offerRkey(input.offerId) }).catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  return { offer: { ...r.value, offerUri: r.uri } };
}

export async function listOffers(e: Etzhayyim, input: ListOffersInput = {}): Promise<ListOffersOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<OfferRecord>({ collection: OFFER_COLLECTION, cursor: input.cursor, limit });
  const origin = input.originIata?.toUpperCase();
  const dest = input.destIata?.toUpperCase();
  const items: OfferView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (origin && v.originIata !== origin) return false;
      if (dest && v.destIata !== dest) return false;
      if (input.departureDate && v.departureDate !== input.departureDate) return false;
      if (input.provider && v.provider !== input.provider) return false;
      return true;
    })
    .map((r) => ({ ...r.value, offerUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

async function scanAll<T>(e: Etzhayyim, collection: string, maxScan: number, onRow: (v: T, uri: string) => void): Promise<number> {
  let cursor: string | undefined;
  let scanned = 0;
  while (scanned < maxScan) {
    const page = await e.read<T>({ collection, cursor, limit: PAGE_LIMIT });
    for (const r of page.records) {
      if (scanned >= maxScan) break;
      onRow(r.value, r.uri);
      scanned += 1;
    }
    if (scanned >= maxScan || !page.cursor || page.records.length < PAGE_LIMIT) break;
    cursor = page.cursor;
  }
  return scanned;
}

export async function getCheapestFare(e: Etzhayyim, input: GetCheapestFareInput): Promise<GetCheapestFareOutput> {
  const origin = input.originIata?.toUpperCase();
  const dest = input.destIata?.toUpperCase();
  if (!isAirportIata(origin ?? "") || !isAirportIata(dest ?? "")) return { error: "invalidAirportIata" };
  const maxScan = Math.min(input.maxScan ?? DEFAULT_MAX_SCAN, DEFAULT_MAX_SCAN);
  let cheapest: OfferView | undefined;
  let offerCount = 0;
  const scanned = await scanAll<OfferRecord>(e, OFFER_COLLECTION, maxScan, (v, uri) => {
    if (v.originIata !== origin || v.destIata !== dest) return;
    if (input.departureDate && v.departureDate !== input.departureDate) return;
    offerCount += 1;
    if (!cheapest || ltMicros(v.priceMicros, cheapest.priceMicros)) {
      cheapest = { ...v, offerUri: uri };
    }
  });
  return { cheapest, offerCount, truncated: scanned >= maxScan };
}

// ─── Watch ──────────────────────────────────────────────────────────

export async function createWatch(e: Etzhayyim, input: CreateWatchInput): Promise<CreateWatchOutput> {
  if (!input.watchId || !input.watcherDid || !input.departureDate) return { status: "rejected", error: "missingRequiredFields" };
  if (!input.watcherDid.startsWith("did:")) return { status: "rejected", error: "invalidWatcherDid" };
  const origin = input.originIata?.toUpperCase();
  const dest = input.destIata?.toUpperCase();
  if (!isAirportIata(origin ?? "") || !isAirportIata(dest ?? "")) return { status: "rejected", error: "invalidAirportIata" };
  if (!isUintString(input.thresholdMicros)) return { status: "rejected", error: "invalidThresholdMicros" };
  if (!isCurrency((input.currency ?? "").toUpperCase())) return { status: "rejected", error: "invalidCurrency" };
  const rkey = watchRkey(input.watchId);
  const existing = await e.read<WatchRecord>({ collection: WATCH_COLLECTION, rkey }).catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { status: "alreadyExists", watchUri: existing.records[0].uri, did: existing.records[0].value.did, watchId: input.watchId };
  }
  const did = watchDidFor(input.watchId);
  const record: WatchRecord = {
    did,
    watchId: input.watchId,
    watcherDid: input.watcherDid,
    originIata: origin!,
    destIata: dest!,
    departureDate: input.departureDate,
    returnDate: input.returnDate,
    thresholdMicros: input.thresholdMicros,
    currency: input.currency.toUpperCase(),
    status: "active",
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({ collection: WATCH_COLLECTION, record: record as unknown as Record<string, unknown>, rkey });
  return { status: "created", watchUri: receipt.uri, did, watchId: input.watchId };
}

export async function cancelWatch(e: Etzhayyim, input: CancelWatchInput): Promise<CancelWatchOutput> {
  if (!input.watchId) return { status: "rejected", error: "invalidWatchId" };
  const rkey = watchRkey(input.watchId);
  const resp = await e.read<WatchRecord>({ collection: WATCH_COLLECTION, rkey }).catch(() => ({ records: [] }));
  const watch = resp.records[0]?.value;
  if (!watch) return { status: "notFound", error: "watchNotFound" };
  if (watch.status !== "active") return { status: "rejected", error: "alreadyCancelled" };
  await e.write({ collection: WATCH_COLLECTION, record: { ...watch, status: "cancelled" } as unknown as Record<string, unknown>, rkey });
  return { status: "cancelled", watchId: input.watchId };
}

export async function listWatches(e: Etzhayyim, input: ListWatchesInput = {}): Promise<ListWatchesOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<WatchRecord>({ collection: WATCH_COLLECTION, cursor: input.cursor, limit });
  const origin = input.originIata?.toUpperCase();
  const dest = input.destIata?.toUpperCase();
  const items: WatchView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.watcherDid && v.watcherDid !== input.watcherDid) return false;
      if (origin && v.originIata !== origin) return false;
      if (dest && v.destIata !== dest) return false;
      if (input.status && v.status !== input.status) return false;
      return true;
    })
    .map((r) => ({ ...r.value, watchUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

// ─── Alert ──────────────────────────────────────────────────────────

export async function fireAlert(e: Etzhayyim, input: FireAlertInput): Promise<FireAlertOutput> {
  if (!input.alertId || !input.watchId || !input.triggeredAt) return { status: "rejected", error: "missingRequiredFields" };
  if (!isUintString(input.priceMicros)) return { status: "rejected", error: "invalidPriceMicros" };
  if (!isCurrency((input.currency ?? "").toUpperCase())) return { status: "rejected", error: "invalidCurrency" };
  if (!(await exists(e, WATCH_COLLECTION, watchRkey(input.watchId)))) {
    return { status: "watchNotFound", error: `watchNotFound:${input.watchId}` };
  }
  const rkey = alertRkey(input.alertId);
  const existing = await e.read<AlertRecord>({ collection: ALERT_COLLECTION, rkey }).catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { status: "alreadyExists", alertUri: existing.records[0].uri, did: existing.records[0].value.did, alertId: input.alertId };
  }
  const did = alertDidFor(input.alertId);
  const record: AlertRecord = {
    did,
    alertId: input.alertId,
    watchId: input.watchId,
    offerId: input.offerId,
    priceMicros: input.priceMicros,
    currency: input.currency.toUpperCase(),
    triggeredAt: input.triggeredAt,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({ collection: ALERT_COLLECTION, record: record as unknown as Record<string, unknown>, rkey });
  return { status: "fired", alertUri: receipt.uri, did, alertId: input.alertId };
}

export async function listAlerts(e: Etzhayyim, input: ListAlertsInput = {}): Promise<ListAlertsOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<AlertRecord>({ collection: ALERT_COLLECTION, cursor: input.cursor, limit });
  const items: AlertView[] = resp.records
    .filter((r) => (input.watchId ? r.value.watchId === input.watchId : true))
    .map((r) => ({ ...r.value, alertUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

// ─── Coverage ───────────────────────────────────────────────────────

export async function coverage(e: Etzhayyim, input: CoverageInput = {}): Promise<CoverageOutput> {
  const maxScan = Math.min(input.maxScan ?? DEFAULT_MAX_SCAN, DEFAULT_MAX_SCAN);
  const offersByProvider: Record<string, number> = {};
  const offerCount = await scanAll<OfferRecord>(e, OFFER_COLLECTION, maxScan, (v) => {
    offersByProvider[v.provider] = (offersByProvider[v.provider] ?? 0) + 1;
  });
  const watchesByStatus: Record<string, number> = {};
  const watchCount = await scanAll<WatchRecord>(e, WATCH_COLLECTION, maxScan, (v) => {
    watchesByStatus[v.status] = (watchesByStatus[v.status] ?? 0) + 1;
  });
  const alertCount = await scanAll<AlertRecord>(e, ALERT_COLLECTION, maxScan, () => {});
  return {
    offerCount,
    watchCount,
    alertCount,
    watchesByStatus,
    offersByProvider,
    truncated: offerCount >= maxScan || watchCount >= maxScan || alertCount >= maxScan,
  };
}
