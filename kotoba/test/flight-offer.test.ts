import { describe, it, expect, beforeEach } from "vitest";
import { MockEtzhayyim } from "@etzhayyim/sdk-mock";
import {
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
} from "../src/index.js";

const WATCHER = "did:web:traveler.example.com";
const baseOffer = { originIata: "HND", destIata: "SIN", departureDate: "2026-09-01", currency: "jpy", provider: "amadeus" as const, observedAt: "2026-06-01T00:00:00Z" };

describe("flight-offer kotoba", () => {
  let e: any;
  beforeEach(() => {
    e = new MockEtzhayyim({ did: "did:web:flight-offer.etzhayyim.com" });
  });

  describe("offers + cheapest-fare rollup", () => {
    it("records, reads, lists by route, finds cheapest (string-micros compare)", async () => {
      expect((await recordOffer(e, { offerId: "O-1", ...baseOffer, priceMicros: "85000000000", carrierIata: "SQ" })).status).toBe("recorded");
      expect((await recordOffer(e, { offerId: "O-2", ...baseOffer, priceMicros: "72000000000", provider: "duffel" })).status).toBe("recorded");
      expect((await recordOffer(e, { offerId: "O-3", ...baseOffer, priceMicros: "120000000000" })).status).toBe("recorded");
      expect((await getOffer(e, { offerId: "O-1" })).offer?.currency).toBe("JPY");
      expect((await listOffers(e, { originIata: "HND", destIata: "SIN" })).total).toBe(3);
      const cheap = await getCheapestFare(e, { originIata: "hnd", destIata: "sin", departureDate: "2026-09-01" });
      expect(cheap.cheapest?.offerId).toBe("O-2"); // 72bn < 85bn < 120bn (equal length → lexicographic)
      expect(cheap.offerCount).toBe(3);
    });
    it("rejects bad airport/price/provider/same-route", async () => {
      expect((await recordOffer(e, { offerId: "X", ...baseOffer, originIata: "HN", priceMicros: "1" })).status).toBe("rejected");
      expect((await recordOffer(e, { offerId: "X", ...baseOffer, priceMicros: "12.5" })).status).toBe("rejected");
      expect((await recordOffer(e, { offerId: "X", ...baseOffer, priceMicros: "1", provider: "bogus" as any })).status).toBe("rejected");
      expect((await recordOffer(e, { offerId: "X", ...baseOffer, destIata: "HND", priceMicros: "1" })).status).toBe("rejected");
    });
  });

  describe("watches + alerts", () => {
    it("creates DID-keyed watch, cancels, lists; fires alert FK→watch", async () => {
      expect((await createWatch(e, { watchId: "W-1", watcherDid: WATCHER, originIata: "HND", destIata: "SIN", departureDate: "2026-09-01", thresholdMicros: "80000000000", currency: "JPY" })).status).toBe("created");
      expect((await createWatch(e, { watchId: "W-X", watcherDid: "nope", originIata: "HND", destIata: "SIN", departureDate: "x", thresholdMicros: "1", currency: "JPY" })).status).toBe("rejected");
      expect((await listWatches(e, { watcherDid: WATCHER, status: "active" })).total).toBe(1);
      expect((await fireAlert(e, { alertId: "AL-1", watchId: "W-1", priceMicros: "72000000000", currency: "JPY", triggeredAt: "2026-06-05T00:00:00Z", offerId: "O-2" })).status).toBe("fired");
      expect((await fireAlert(e, { alertId: "AL-X", watchId: "GHOST", priceMicros: "1", currency: "JPY", triggeredAt: "x" })).status).toBe("watchNotFound");
      expect((await listAlerts(e, { watchId: "W-1" })).total).toBe(1);
      expect((await cancelWatch(e, { watchId: "W-1" })).status).toBe("cancelled");
      expect((await cancelWatch(e, { watchId: "W-1" })).status).toBe("rejected");
    });
    it("coverage rolls up the three collections", async () => {
      await recordOffer(e, { offerId: "O-1", ...baseOffer, priceMicros: "72000000000" });
      await createWatch(e, { watchId: "W-1", watcherDid: WATCHER, originIata: "HND", destIata: "SIN", departureDate: "2026-09-01", thresholdMicros: "80000000000", currency: "JPY" });
      await fireAlert(e, { alertId: "AL-1", watchId: "W-1", priceMicros: "72000000000", currency: "JPY", triggeredAt: "2026-06-05T00:00:00Z" });
      const cov = await coverage(e);
      expect(cov.offerCount).toBe(1);
      expect(cov.watchCount).toBe(1);
      expect(cov.alertCount).toBe(1);
      expect(cov.offersByProvider?.amadeus).toBe(1);
      expect(cov.watchesByStatus?.active).toBe(1);
    });
  });
});
