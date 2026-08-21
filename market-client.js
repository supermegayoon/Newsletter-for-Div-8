// File: /market-client.js
// DAILY FIXED MARKET MODE.
// Market: /api/market
// Raw materials: latest GitHub data through existing /api/raw-material-update GET.

(() => {
  const fmt=(n,d=2)=>Number(n).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
  const pc=n=>Number(n)>0?"up":Number(n)<0?"down":"flat";
  const pt=n=>{
    if(n===null||n===undefined||!Number.isFinite(Number(n)))return "—";
    n=Number(n);return `${n>0?"▲":n<0?"▼":""} ${Math.abs(n).toFixed(2)}%`;
  };

  async function getFixedMarket(){
    const r=await fetch(`/api/market?t=${Date.now()}`,{cache:"no-store"});
    const j=await r.json();
    if(!r.ok)throw new Error(j?.error||`market ${r.status}`);
    return j;
  }

  async function getRaw(){
    try{
      const r=await fetch(`/api/raw-material-update?t=${Date.now()}`,{cache:"no-store"});
      const j=await r.json();
      if(!r.ok || j?.ok===false)throw new Error(j?.error||`raw material ${r.status}`);
      return j;
    }catch(e){
      console.error("[Raw Material API]",e);
      return {rawMaterials:(typeof CONFIG!=="undefined"?CONFIG.rawMaterials:{})||{}};
    }
  }

  function renderStocks(data){
    const grid=document.getElementById("kpi-grid");if(!grid)return;
    const defs=[["KSS","Kohl's (KSS)"],["ANF","Abercrombie & Fitch (ANF)"],["M","Macy's (M)"]];
    grid.innerHTML=defs.map(([s,l])=>{
      const d=data?.[s];
      return `<div class="kpi-card">
        <div class="kpi-label">${l}</div>
        <div class="kpi-value">${d?.price!=null?`$${fmt(d.price)}`:"—"}</div>
        <div class="kpi-delta ${pc(d?.changePct)}">${pt(d?.changePct)}</div>
      </div>`;
    }).join("");
  }

  function renderKRW(data){
    const d=data?.["KRW=X"],val=document.getElementById("fx-val"),note=document.getElementById("fx-note");
    if(!val)return;
    val.innerHTML=d?.price!=null
      ? `₩${Number(d.price).toLocaleString("ko-KR",{minimumFractionDigits:2,maximumFractionDigits:2})} <small class="${pc(d.changePct)}">${pt(d.changePct)}</small>`
      : "—";
    if(note)note.innerHTML=`<span class="kr">USD/KRW · KST 08:00 Daily Fixed</span><span class="en">USD/KRW · KST 08:00 Daily Fixed</span>`;
  }

  function style(){
    if(document.getElementById("rm-dash-style"))return;
    const s=document.createElement("style");s.id="rm-dash-style";
    s.textContent=`
      .rm-dashboard{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px;box-shadow:var(--shadow);margin:0 0 24px}
      .rm-head{font-size:14px;font-weight:800;margin-bottom:12px}.rm-sub{font-size:9.5px;color:var(--muted);font-weight:500;margin-top:2px}
      .rm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .rm-item{background:var(--panel2);border:1px solid var(--line);border-radius:9px;padding:11px}
      .rm-name{font-size:11px;font-weight:750}.rm-src{font-size:8.5px;color:var(--muted);margin-top:2px}
      .rm-val{font-size:19px;font-weight:800;margin-top:7px}.rm-unit{font-size:8.5px;color:var(--muted)}
      .rm-chg{font-size:10px;font-weight:700;margin-top:3px}.market-fixed-note{font-size:9px;color:var(--muted);margin-top:8px}
      @media(max-width:700px){.rm-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function item(name,price,chg,unit,src){
    return `<div class="rm-item"><div class="rm-name">${name}</div><div class="rm-src">${src||""}</div>
      <div class="rm-val">${price==null?"—":fmt(price)} <span class="rm-unit">${unit||""}</span></div>
      <div class="rm-chg ${pc(chg)}">${pt(chg)}</div></div>`;
  }

  function renderRaw(data,rawDoc,marketDoc){
    style();
    const fxCard=document.getElementById("fx-val")?.closest(".r-card");if(!fxCard)return;
    document.getElementById("raw-material-dashboard")?.remove();
    const rm=rawDoc?.rawMaterials||{},usAuto=data?.["CTZ26.NYB"],wti=data?.["CL=F"],brent=data?.["BZ=F"];
    const us=usAuto?.price!=null?{price:usAuto.price,changePct:usAuto.changePct,unit:"¢/lb"}:rm.usCotton;
    const panel=document.createElement("section");panel.id="raw-material-dashboard";panel.className="rm-dashboard";
    const marketDate=marketDoc?.marketDataDate?` · Market data ${marketDoc.marketDataDate}`:"";
    const rawUpdated=rawDoc?.updatedAt?` · Raw ${String(rawDoc.updatedAt).slice(0,10)}`:"";
    panel.innerHTML=`
      <div class="rm-head">RAW MATERIAL DASHBOARD<div class="rm-sub">Daily fixed market snapshot + latest GitHub raw material report</div></div>
      <div class="rm-grid">
        ${item("U.S. Cotton",us?.price,us?.changePct,us?.unit||"¢/lb","ICE Dec-26 / weekly fallback")}
        ${item("China Cotton",rm.chinaCotton?.price,rm.chinaCotton?.changePct,rm.chinaCotton?.unit||"¢/lb","Weekly report")}
        ${item("India Cotton",rm.indiaCotton?.price,rm.indiaCotton?.changePct,rm.indiaCotton?.unit||"¢/lb","Weekly report")}
        ${item("PSF",rm.psf?.price,rm.psf?.changePct,rm.psf?.unit||"¢/lb","Weekly report")}
        ${item("DTY",rm.dty?.price,rm.dty?.changePct,rm.dty?.unit||"¢/lb","Weekly report")}
        ${item("WTI Crude",wti?.price,wti?.changePct,"USD/bbl","NYMEX")}
        ${item("Brent Crude",brent?.price,brent?.changePct,"USD/bbl","Global benchmark")}
      </div>
      <div class="market-fixed-note">KST 08:00 Daily Fixed · Snapshot ${marketDoc?.snapshotDateKST||""}${marketDate}${rawUpdated}</div>`;
    fxCard.insertAdjacentElement("afterend",panel);
  }

  async function start(){
    try{
      const [m,r]=await Promise.all([getFixedMarket(),getRaw()]);
      renderStocks(m.data||{});renderKRW(m.data||{});renderRaw(m.data||{},r,m);
    }catch(e){console.error("[Fixed Market]",e);}
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
