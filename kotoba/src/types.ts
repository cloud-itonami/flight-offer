/**
 * flight-offer kotoba — flight-fare aggregation record types.
 *
 * Per ADR-2606011400. flight-offer is a Skyscanner-equivalent fare aggregator:
 * it polls providers (Amadeus / Duffel), persists fare offers, lets users watch a
 * route+date, and fires drop alerts. Registry on AT PDS records (replaces
 * vertex_flight_offer / vertex_flight_offer_alert). ADR-2605172000 kotoba.
 *
 * AXIS NOTE (ADR-2605172400): axis-clean — it does NOT book or sell tickets
 * (no MoR / settlement; booking is air-book / the provider). Fares are public
 * open-data; a watch is a DID-keyed route subscription (route + threshold + DID,
 * no sensitive PII). No fulfillment liability (informational, like Skyscanner).
 *
 * AT-Lexicon: no float. Prices are decimal STRINGS in micros.
 *
 * Identity hierarchy:
 *   did:web:flight-offer.etzhayyim.com                       — controller
 *   did:web:flight-offer.etzhayyim.com:offer:{offerId}       — a fare offer
 *   did:web:flight-offer.etzhayyim.com:watch:{watchId}       — a route watch
 *   did:web:flight-offer.etzhayyim.com:alert:{alertId}       — a drop alert
 */

export const FO_DID_PREFIX = "did:web:flight-offer.etzhayyim.com:" as const;

export const OFFER_COLLECTION = "com.etzhayyim.apps.flightOffer.offer";
export const WATCH_COLLECTION = "com.etzhayyim.apps.flightOffer.watch";
export const ALERT_COLLECTION = "com.etzhayyim.apps.flightOffer.alert";

// ─── Offer ──────────────────────────────────────────────────────────

export type Provider = "amadeus" | "duffel" | "kiwi" | "sabre" | "other";

export interface OfferRecord {
  did: string;
  offerId: string;
  originIata: string;
  destIata: string;
  /** Outbound date YYYY-MM-DD. */
  departureDate: string;
  /** Return date YYYY-MM-DD (one-way if absent). */
  returnDate?: string;
  carrierIata?: string;
  /** Total fare in micros (decimal string). */
  priceMicros: string;
  currency: string;
  provider: Provider;
  observedAt: string;
  createdAt: string;
}
export interface OfferView extends OfferRecord {
  offerUri: string;
}
export interface RecordOfferInput {
  offerId: string;
  originIata: string;
  destIata: string;
  departureDate: string;
  priceMicros: string;
  currency: string;
  provider: Provider;
  observedAt: string;
  returnDate?: string;
  carrierIata?: string;
}
export interface RecordOfferOutput {
  status: "recorded" | "alreadyExists" | "rejected";
  offerUri?: string;
  did?: string;
  offerId?: string;
  error?: string;
}
export interface GetOfferInput {
  offerId: string;
}
export interface GetOfferOutput {
  offer?: OfferView;
  error?: string;
}
export interface ListOffersInput {
  originIata?: string;
  destIata?: string;
  departureDate?: string;
  provider?: Provider;
  limit?: number;
  cursor?: string;
}
export interface ListOffersOutput {
  items: OfferView[];
  cursor?: string;
  total: number;
}
export interface GetCheapestFareInput {
  originIata: string;
  destIata: string;
  departureDate?: string;
  maxScan?: number;
}
export interface GetCheapestFareOutput {
  cheapest?: OfferView;
  offerCount?: number;
  truncated?: boolean;
  error?: string;
}

// ─── Watch ──────────────────────────────────────────────────────────

export type WatchStatus = "active" | "cancelled";

export interface WatchRecord {
  did: string;
  watchId: string;
  /** DID of the watcher (subscription owner). */
  watcherDid: string;
  originIata: string;
  destIata: string;
  departureDate: string;
  returnDate?: string;
  /** Alert when cheapest fare falls at/below this (micros, decimal string). */
  thresholdMicros: string;
  currency: string;
  status: WatchStatus;
  createdAt: string;
}
export interface WatchView extends WatchRecord {
  watchUri: string;
}
export interface CreateWatchInput {
  watchId: string;
  watcherDid: string;
  originIata: string;
  destIata: string;
  departureDate: string;
  thresholdMicros: string;
  currency: string;
  returnDate?: string;
}
export interface CreateWatchOutput {
  status: "created" | "alreadyExists" | "rejected";
  watchUri?: string;
  did?: string;
  watchId?: string;
  error?: string;
}
export interface CancelWatchInput {
  watchId: string;
}
export interface CancelWatchOutput {
  status: "cancelled" | "notFound" | "rejected";
  watchId?: string;
  error?: string;
}
export interface ListWatchesInput {
  watcherDid?: string;
  originIata?: string;
  destIata?: string;
  status?: WatchStatus;
  limit?: number;
  cursor?: string;
}
export interface ListWatchesOutput {
  items: WatchView[];
  cursor?: string;
  total: number;
}

// ─── Alert ──────────────────────────────────────────────────────────

export interface AlertRecord {
  did: string;
  alertId: string;
  /** FK → watch watchId. */
  watchId: string;
  /** Offer that triggered the alert (optional FK). */
  offerId?: string;
  priceMicros: string;
  currency: string;
  triggeredAt: string;
  createdAt: string;
}
export interface AlertView extends AlertRecord {
  alertUri: string;
}
export interface FireAlertInput {
  alertId: string;
  watchId: string;
  priceMicros: string;
  currency: string;
  triggeredAt: string;
  offerId?: string;
}
export interface FireAlertOutput {
  status: "fired" | "alreadyExists" | "rejected" | "watchNotFound";
  alertUri?: string;
  did?: string;
  alertId?: string;
  error?: string;
}
export interface ListAlertsInput {
  watchId?: string;
  limit?: number;
  cursor?: string;
}
export interface ListAlertsOutput {
  items: AlertView[];
  cursor?: string;
  total: number;
}

// ─── Coverage ───────────────────────────────────────────────────────

export interface CoverageInput {
  maxScan?: number;
}
export interface CoverageOutput {
  offerCount?: number;
  watchCount?: number;
  alertCount?: number;
  watchesByStatus?: Record<string, number>;
  offersByProvider?: Record<string, number>;
  truncated?: boolean;
  error?: string;
}

// ─── Validation + helpers ───────────────────────────────────────────

export const PROVIDERS: ReadonlySet<string> = new Set(["amadeus", "duffel", "kiwi", "sabre", "other"]);

export function isAirportIata(s: string): boolean {
  return /^[A-Z]{3}$/.test(s);
}
export function isCarrierIata(s: string): boolean {
  return /^[A-Z0-9]{2}$/.test(s);
}
export function isCurrency(s: string): boolean {
  return /^[A-Z]{3}$/.test(s);
}
export function isUintString(s: string): boolean {
  return /^\d+$/.test(s);
}
/** Compare decimal-string micros (non-negative). */
export function ltMicros(a: string, b: string): boolean {
  if (a.length !== b.length) return a.length < b.length;
  return a < b;
}

export function offerDidFor(id: string): string {
  return `${FO_DID_PREFIX}offer:${id.toLowerCase()}`;
}
export function offerRkey(id: string): string {
  return `offer-${id.toLowerCase()}`;
}
export function watchDidFor(id: string): string {
  return `${FO_DID_PREFIX}watch:${id.toLowerCase()}`;
}
export function watchRkey(id: string): string {
  return `watch-${id.toLowerCase()}`;
}
export function alertDidFor(id: string): string {
  return `${FO_DID_PREFIX}alert:${id.toLowerCase()}`;
}
export function alertRkey(id: string): string {
  return `alert-${id.toLowerCase()}`;
}
