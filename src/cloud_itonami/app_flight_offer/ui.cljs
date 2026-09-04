(ns cloud-itonami.app-flight-offer.ui
  "View tree for the flight-offer appview. Structural chrome comes from
  appkit.core / kotoba-ui.core (murakumo-studio構成). Single screen:
  top header, facts grid, public-routes panel, runtime-bindings panel and a
  source-path panel."
  (:require [appkit.core :as shape]
            [kotoba-ui.core :as ui]
            [cloud-itonami.app-flight-offer.state :as state]))

(def css-text
  "
.fo-app { min-height: 100vh; padding: 24px; background: var(--liquid-glass-bg, #11161d); color: var(--liquid-glass-fg, #eef4f8); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif; }
.fo-top { margin-bottom: 18px; }
.fo-top p, .fo-top span, .fo-muted, h2, .fo-facts span { color: #96a6b8; }
.fo-top p { margin: 0 0 8px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
h1, h2, p { margin: 0; }
h1 { font-size: clamp(28px, 5vw, 48px); line-height: 1.05; }
.fo-top span { display: block; margin-top: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; overflow-wrap: anywhere; }
.fo-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
.fo-facts > div, .fo-panel { border: 1px solid #2b3948; border-radius: 8px; background: #171f28; }
.fo-facts > div { padding: 14px; }
.fo-facts span { display: block; margin-bottom: 8px; font-size: 12px; }
.fo-facts strong { overflow-wrap: anywhere; }
.fo-panel { margin-bottom: 12px; padding: 16px; }
h2 { margin-bottom: 12px; font-size: 13px; text-transform: uppercase; }
.fo-panel ul { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.fo-panel li, .fo-path p { border: 1px solid #263443; border-radius: 6px; background: #101720; padding: 9px 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; overflow-wrap: anywhere; }
.fo-chips { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
@media (max-width: 760px) { .fo-app { padding: 18px; } .fo-facts { grid-template-columns: 1fr; } }
")

(defn- fact [label value]
  [:div [:span label] [:strong value]])

(defn- panel [title body]
  [shape/panel
   [:div.fo-panel
    [:h2 title]
    body]])

(defn root []
  (let [{:keys [title project name kind route-count routes vars xrpc relative-path]}
        (:app @state/state)]
    [:div
     [:style css-text]
     [:main.fo-app
      [:section.fo-top
       [:p "Cloudflare " kind]
       [:h1 title]
       [:span name]]
      [:section.fo-facts
       [fact "Project" project]
       [fact "Routes" (str route-count)]
       [fact "XRPC" (if xrpc "enabled" "not configured")]]
      [panel "Public Routes"
       (if (seq routes)
         [:ul (for [r routes] ^{:key r} [:li r])]
         [:p.fo-muted "No public route is declared next to this app surface."])]
      [panel "Runtime Bindings"
       (if (seq vars)
         [:ul.fo-chips (for [v vars] ^{:key v} [:li v])]
         [:p.fo-muted "No public vars are declared in the nearest wrangler config."])]
      [:section.fo-path
       [panel "Source" [:p relative-path]]]]]))
