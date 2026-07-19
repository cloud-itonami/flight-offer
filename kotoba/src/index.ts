/**
 * flight-offer kotoba — barrel.
 *
 * Per ADR-2606011400. Skyscanner-equivalent flight-fare aggregation (public
 * open-data) on the etzhayyim substrate (AT PDS records; no RW).
 *
 *   offer : recordOffer / getOffer / listOffers / getCheapestFare (rollup)
 *   watch : createWatch (DID-keyed) / cancelWatch / listWatches
 *   alert : fireAlert (FK→watch) / listAlerts
 *   coverage
 *
 * No ticketing / settlement; prices are decimal-string micros.
 */

export * from "./types.js";
export {
  recordOffer,
  getOffer,
  listOffers,
  getCheapestFare,
  createWatch,
  cancelWatch,
  listWatches,
  fireAlert,
  listAlerts,
  coverage,
} from "./registry.js";
