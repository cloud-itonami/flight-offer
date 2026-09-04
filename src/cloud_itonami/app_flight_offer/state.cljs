(ns cloud-itonami.app-flight-offer.state
  "App state for the flight-offer appview UI. Single reagent atom mirroring
  the app descriptor that appview/etzhayyim-wasm-flight-offer-fl1ghts1/svelte's
  +page.svelte rendered (project facts, routes, runtime bindings)."
  (:require [reagent.core :as r]))

(defonce state
  (r/atom
   {:app {:title "Flight Offer Fl1ghts1"
          :project "etzhayyim-project-flight-offer"
          :name "etzhayyim-wasm-flight-offer-fl1ghts1"
          :kind "appview"
          :route-count 0
          :routes []
          :vars []
          :xrpc true
          :relative-path "60-apps/etzhayyim-project-flight-offer/appview/etzhayyim-wasm-flight-offer-fl1ghts1/svelte/src/routes/+page.svelte"}}))
