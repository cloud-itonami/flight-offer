(ns cloud-itonami.app-flight-offer.state
  "App state for the flight-offer appview UI. Single reagent atom with the
  project facts, routes, and runtime bindings the former +page.svelte showed."
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
          :xrpc false
          :relative-path "src/cloud_itonami/app_flight_offer/ui.cljs"}}))
