import { createWorkerExport } from "@etzhayyim/kotodama-host-sdk";

const EMBED_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Flight Offer</title>
<style>
  :root { color-scheme: light dark; --bg:#0b0d11; --fg:#e9eef5; --mut:#7a8492; --acc:#3aa1ff; --card:#141821; --bd:#212833; }
  *{box-sizing:border-box} body{margin:0;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--fg)}
  header{padding:14px 18px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:10px}
  header h1{font-size:15px;margin:0;font-weight:600;letter-spacing:.02em}
  header small{color:var(--mut)}
  main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;padding:14px}
  section{background:var(--card);border:1px solid var(--bd);border-radius:8px;padding:14px}
  section h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin:0 0 10px}
  label{display:block;font-size:11px;color:var(--mut);margin-bottom:4px;letter-spacing:.04em}
  input,select,button{font:inherit;background:#0e1218;color:var(--fg);border:1px solid var(--bd);border-radius:5px;padding:7px 9px;width:100%}
  button{background:var(--acc);border-color:var(--acc);color:#fff;cursor:pointer;font-weight:500;width:auto;padding:7px 14px}
  button:hover{filter:brightness(1.08)} button:disabled{opacity:.5;cursor:default}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}
  .row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px}
  pre{margin:8px 0 0;padding:9px;background:#0a0d12;border:1px solid var(--bd);border-radius:5px;overflow:auto;font-size:12px;max-height:260px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{padding:5px 7px;border-bottom:1px solid var(--bd);text-align:left}
  th{color:var(--mut);font-weight:500;text-transform:uppercase;letter-spacing:.04em;font-size:10px}
  .price{font-weight:600;color:var(--acc)}
  .err{color:#ff7676}
</style>
</head>
<body>
<header>
  <h1>Flight Offer</h1><small>Skyscanner-equivalent · BPMN-as-actor</small>
</header>
<main>
  <section id="sec-search">
    <h2>Search Offers</h2>
    <div class="row3">
      <div><label>Origin (IATA)</label><input id="s-org" maxlength="3" placeholder="NRT"/></div>
      <div><label>Dest (IATA)</label><input id="s-dst" maxlength="3" placeholder="SIN"/></div>
      <div><label>Currency</label><input id="s-ccy" maxlength="3" value="USD"/></div>
    </div>
    <div class="row">
      <div><label>Outbound</label><input id="s-out" type="date"/></div>
      <div><label>Return (opt)</label><input id="s-ret" type="date"/></div>
    </div>
    <div class="row">
      <div><label>Provider (opt)</label>
        <select id="s-pv"><option value="">auto</option><option>amadeus</option><option>duffel</option><option>stub</option></select>
      </div>
      <div><label>Max offers</label><input id="s-max" type="number" min="1" max="50" value="20"/></div>
    </div>
    <button data-act="search">Search</button>
    <pre id="o-search"></pre>
  </section>

  <section>
    <h2>Get Cheapest</h2>
    <div class="row3">
      <div><label>Origin</label><input id="c-org" maxlength="3"/></div>
      <div><label>Dest</label><input id="c-dst" maxlength="3"/></div>
      <div><label>Currency</label><input id="c-ccy" maxlength="3" value="USD"/></div>
    </div>
    <div class="row"><div><label>Outbound</label><input id="c-out" type="date"/></div><div></div></div>
    <button data-act="cheapest">Lookup</button>
    <pre id="o-cheapest"></pre>
  </section>

  <section>
    <h2>Add Watch</h2>
    <div class="row3">
      <div><label>Origin</label><input id="w-org" maxlength="3"/></div>
      <div><label>Dest</label><input id="w-dst" maxlength="3"/></div>
      <div><label>Currency</label><input id="w-ccy" maxlength="3" value="USD"/></div>
    </div>
    <div class="row3">
      <div><label>Outbound</label><input id="w-out" type="date"/></div>
      <div><label>Threshold %</label><input id="w-th" type="number" min="0" step="0.5" value="10"/></div>
      <div><label>Cadence (min)</label><input id="w-cad" type="number" min="30" value="360"/></div>
    </div>
    <button data-act="addWatch">Add watch</button>
    <pre id="o-add"></pre>
  </section>

  <section>
    <h2>Watchlist</h2>
    <div class="row"><div><label>Status</label>
      <select id="l-status"><option>active</option><option>archived</option><option value="">(all)</option></select>
    </div><div style="align-self:end"><button data-act="listWatch">Refresh</button></div></div>
    <div id="o-list"><em style="color:var(--mut)">click refresh</em></div>
  </section>

  <section style="grid-column:1/-1">
    <h2>Source Health <button data-act="health" style="margin-left:8px;font-size:11px;padding:4px 10px">Refresh</button></h2>
    <div id="o-health"><em style="color:var(--mut)">click refresh</em></div>
  </section>
</main>
<script>
const BASE = "https://atproto.etzhayyim.com/xrpc";
function nonEmpty(o){const r={};for(const[k,v] of Object.entries(o))if(v!==""&&v!=null&&!Number.isNaN(v))r[k]=v;return r}
async function call(nsid, body){
  const res = await fetch(BASE+"/"+nsid,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body||{})});
  const txt = await res.text();
  try{return{status:res.status,json:JSON.parse(txt)}}catch{return{status:res.status,raw:txt}}
}
function show(id, r){document.getElementById(id).textContent = JSON.stringify(r,null,2)}
function val(id){return (document.getElementById(id).value||"").trim()}
function num(id){const v=parseFloat(val(id));return Number.isFinite(v)?v:undefined}

async function doSearch(){
  show("o-search","…");
  const r = await call("com.etzhayyim.apps.flightOffer.searchOffers", nonEmpty({
    originIata:val("s-org").toUpperCase(), destinationIata:val("s-dst").toUpperCase(),
    outboundDate:val("s-out"), returnDate:val("s-ret"),
    currency:val("s-ccy").toUpperCase(), provider:val("s-pv"), maxOffers:num("s-max")
  }));
  show("o-search", r);
}

async function doCheapest(){
  show("o-cheapest","…");
  const r = await call("com.etzhayyim.apps.flightOffer.getCheapest", nonEmpty({
    originIata:val("c-org").toUpperCase(), destinationIata:val("c-dst").toUpperCase(),
    outboundDate:val("c-out"), currency:val("c-ccy").toUpperCase()||"USD"
  }));
  show("o-cheapest", r);
}

async function doAdd(){
  show("o-add","…");
  const r = await call("com.etzhayyim.apps.flightOffer.addWatch", nonEmpty({
    originIata:val("w-org").toUpperCase(), destinationIata:val("w-dst").toUpperCase(),
    outboundDate:val("w-out"), currency:val("w-ccy").toUpperCase()||"USD",
    thresholdPct:num("w-th"), cadenceMinutes:num("w-cad")
  }));
  show("o-add", r);
}

async function doList(){
  const out = document.getElementById("o-list");
  out.innerHTML = "<em style='color:var(--mut)'>loading…</em>";
  const r = await call("com.etzhayyim.apps.flightOffer.listWatch", {status:val("l-status"),limit:200});
  if(r.status!==200||!r.json||!Array.isArray(r.json.items)){out.innerHTML="<span class='err'>"+(r.json?.error||r.raw||r.status)+"</span>";return}
  if(!r.json.items.length){out.innerHTML="<em style='color:var(--mut)'>no rows</em>";return}
  let h="<table><thead><tr><th>Route</th><th>Date</th><th>CCY</th><th>Threshold</th><th>Cadence</th><th>Next due</th><th></th></tr></thead><tbody>";
  for(const w of r.json.items){
    const route = (w.originIata||"")+"→"+(w.destinationIata||"");
    h += "<tr><td>"+route+"</td><td>"+(w.outboundDate||"").slice(0,10)+"</td><td>"+(w.currency||"")+"</td><td>"+(w.thresholdPct??"")+"%</td><td>"+(w.cadenceMinutes??"")+"m</td><td>"+(w.nextDueAt||"").slice(0,16)+"</td><td><button data-rm='"+(w.vertexId||"")+"' data-org='"+w.originIata+"' data-dst='"+w.destinationIata+"' data-out='"+w.outboundDate+"' data-ccy='"+w.currency+"'>archive</button></td></tr>";
  }
  out.innerHTML = h+"</tbody></table>";
}

async function doHealth(){
  const out = document.getElementById("o-health");
  out.innerHTML = "<em style='color:var(--mut)'>loading…</em>";
  const r = await call("com.etzhayyim.apps.flightOffer.sourceHealth", {});
  if(r.status!==200||!r.json||!Array.isArray(r.json.sources)){out.innerHTML="<span class='err'>"+(r.json?.error||r.raw||r.status)+"</span>";return}
  if(!r.json.sources.length){out.innerHTML="<em style='color:var(--mut)'>no sources</em>";return}
  let h="<table><thead><tr><th>Source</th><th>Runs</th><th>Success %</th><th>Avg latency</th><th>Last OK</th><th>Creds</th></tr></thead><tbody>";
  for(const s of r.json.sources){
    const pct = s.successRate!=null ? (s.successRate*100).toFixed(1)+"%" : "—";
    const lat = s.avgLatencyMs!=null ? s.avgLatencyMs.toFixed(0)+"ms" : "—";
    const lastOk = s.lastOkAt ? s.lastOkAt.slice(0,16).replace("T"," ") : "—";
    const creds = s.credentialsAvailable ? "✓" : "<span class='err'>✗</span>";
    const color = s.successRate==null ? "" : s.successRate>=0.9 ? "color:#4caf82" : s.successRate>=0.7 ? "color:#f0b73a" : "color:#ff7676";
    h += "<tr><td>"+(s.sourceId||"")+"</td><td>"+(s.runsTotal??0)+"</td><td style='"+color+"'>"+pct+"</td><td>"+lat+"</td><td>"+lastOk+"</td><td>"+creds+"</td></tr>";
  }
  out.innerHTML = h+"</tbody></table>";
}

document.addEventListener("click", async (e)=>{
  const t = e.target;
  if(!(t instanceof HTMLElement)) return;
  if(t.dataset.act==="search") return doSearch();
  if(t.dataset.act==="cheapest") return doCheapest();
  if(t.dataset.act==="addWatch") return doAdd();
  if(t.dataset.act==="listWatch") return doList();
  if(t.dataset.act==="health") return doHealth();
  if(t.dataset.rm){
    t.disabled = true;
    await call("com.etzhayyim.apps.flightOffer.removeWatch", {
      originIata:t.dataset.org, destinationIata:t.dataset.dst,
      outboundDate:t.dataset.out, currency:t.dataset.ccy
    });
    return doList();
  }
});

if (window.parent !== window) window.parent.postMessage({type:"etzhayyim:embed:ready",nanoid:"fl1ghts1"},"*");
</script>
</body>
</html>`;

export default createWorkerExport((sdk) => {
  sdk.router.get("/embed", () => new Response(EMBED_HTML, {
    headers: { "content-type": "text/html; charset=utf-8" },
  }));
  sdk.router.get("/", () => new Response(EMBED_HTML, {
    headers: { "content-type": "text/html; charset=utf-8" },
  }));
});
