// File: /market-client.js
// Raw Material Dashboard - fetches raw-materials.json published by admin updater.
// Auto market indicators: USD/KRW, ICE Cotton Dec-26, WTI, Brent.

(() => {
  const SYMBOLS = ["KSS","ANF","M","KRW=X","CTZ26.NYB","CL=F","BZ=F"];

  const fmt = (n,d=2)=>Number(n).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
  const pc = n => Number(n)>0?"up":Number(n)<0?"down":"flat";
  const pt = n => {
    if (n===null || n===undefined || !Number.isFinite(Number(n))) return "—";
    n=Number(n); return `${n>0?"▲":n<0?"▼":""} ${Math.abs(n).toFixed(2)}%`;
  };

  async function getMarket(){
    const r=await fetch(`/api/market?symbols=${encodeURIComponent(SYMBOLS.join(","))}`);
    if(!r.ok) throw new Error(`market ${r.status}`);
    return r.json();
  }

  async function getRaw(){
    try{
      const r=await fetch(`/raw-materials.json?t=${Date.now()}`,{cache:"no-store"});
      if(!r.ok) throw new Error();
      return r.json();
    }catch{
      return {rawMaterials: window.CONFIG?.rawMaterials || {}};
    }
  }

  function renderStocks(data){
    const grid=document.getElementById("kpi-grid"); if(!grid)return;
    const defs=[["KSS","Kohl's (KSS)"],["ANF","Abercrombie & Fitch (ANF)"],["M","Macy's (M)"]];
    grid.innerHTML=defs.map(([s,l])=>{
      const d=data[s];
      if(!d?.price)return `<div class="kpi-card"><div class="kpi-label">${l}</div><div class="kpi-value" style="font-size:16px;color:var(--muted)">마지막 데이터 없음</div><div class="kpi-delta flat">—</div></div>`;
      return `<div class="kpi-card"><div class="kpi-label">${l}</div><div class="kpi-value">$${fmt(d.price)}</div><div class="kpi-delta ${pc(d.changePct)}">${pt(d.changePct)}</div></div>`;
    }).join("");
  }

  function renderKRW(data){
    const d=data["KRW=X"], val=document.getElementById("fx-val"), note=document.getElementById("fx-note");
    if(!val)return;
    if(!d?.price){val.textContent="마지막 데이터 없음";return;}
    val.innerHTML=`₩${Number(d.price).toLocaleString("ko-KR",{minimumFractionDigits:2,maximumFractionDigits:2})} <small class="${pc(d.changePct)}">${pt(d.changePct)}</small>`;
    if(note)note.innerHTML=`<span class="kr">USD/KRW · 시장 환율</span><span class="en">USD/KRW · Market rate</span>`;
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
      .rm-chg{font-size:10px;font-weight:700;margin-top:3px}
      @media(max-width:700px){.rm-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function item(name,price,chg,unit,src){
    return `<div class="rm-item"><div class="rm-name">${name}</div><div class="rm-src">${src||""}</div><div class="rm-val">${price==null?"—":fmt(price)} <span class="rm-unit">${unit||""}</span></div><div class="rm-chg ${pc(chg)}">${pt(chg)}</div></div>`;
  }

  function renderRaw(data,rawDoc){
    style();
    const fxCard=document.getElementById("fx-val")?.closest(".r-card"); if(!fxCard)return;
    document.getElementById("market-extra-wrap")?.remove();
    document.getElementById("raw-material-dashboard")?.remove();

    const rm=rawDoc?.rawMaterials||{};
    const usAuto=data["CTZ26.NYB"], wti=data["CL=F"], brent=data["BZ=F"];
    const us = usAuto?.price ? {price:usAuto.price,changePct:usAuto.changePct,unit:"¢/lb"} : rm.usCotton;

    const panel=document.createElement("section");
    panel.id="raw-material-dashboard";panel.className="rm-dashboard";
    panel.innerHTML=`
      <div class="rm-head">RAW MATERIAL DASHBOARD
        <div class="rm-sub">Live indicators + weekly raw material report</div>
      </div>
      <div class="rm-grid">
        ${item("U.S. Cotton",us?.price,us?.changePct,us?.unit||"¢/lb","ICE Dec-26 / weekly fallback")}
        ${item("China Cotton",rm.chinaCotton?.price,rm.chinaCotton?.changePct,rm.chinaCotton?.unit||"¢/lb","Weekly report")}
        ${item("India Cotton",rm.indiaCotton?.price,rm.indiaCotton?.changePct,rm.indiaCotton?.unit||"¢/lb","Weekly report")}
        ${item("PSF",rm.psf?.price,rm.psf?.changePct,rm.psf?.unit||"¢/lb","Weekly report")}
        ${item("DTY",rm.dty?.price,rm.dty?.changePct,rm.dty?.unit||"¢/lb","Weekly report")}
        ${item("WTI Crude",wti?.price,wti?.changePct,"USD/bbl","NYMEX")}
        ${item("Brent Crude",brent?.price,brent?.changePct,"USD/bbl","Global benchmark")}
      </div>`;
    fxCard.insertAdjacentElement("afterend",panel);
  }

  async function refresh(){
    try{
      const [m,r]=await Promise.all([getMarket(),getRaw()]);
      renderStocks(m.data||{}); renderKRW(m.data||{}); renderRaw(m.data||{},r);
    }catch(e){console.error("[dashboard]",e);}
  }
  refresh();
  // Market data is a shared daily snapshot generated after 08:00 KST.
  // No 5-minute browser polling: each page simply reads the same saved/cached snapshot.
})();
