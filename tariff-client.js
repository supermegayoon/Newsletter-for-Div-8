// File: /tariff-client.js
// Cached Daily Tariff Watch UI.
// If today's Gemini verification hits quota, yesterday's saved data remains visible.

(()=>{
  let last=null;
  const isEn=()=>document.body.classList.contains("en");
  const fmtRate=r=>r==null?"VERIFY":`+${Number(r).toFixed(Number(r)%1?1:0)}%`;
  const cls=s=>s==="CURRENT"?"ok":s==="PENDING"?"pending":"verify";

  function installStyle(){
    if(document.getElementById("tariff-watch-style"))return;
    const s=document.createElement("style");s.id="tariff-watch-style";
    s.textContent=`
      .tw-status{font:700 8px var(--mono);border-radius:4px;padding:2px 5px;margin-left:5px}
      .tw-status.ok{color:var(--green);background:var(--green-tint)}
      .tw-status.pending{color:#B9770E;background:#FFF4DC}
      .tw-status.verify{color:var(--red);background:var(--red-tint)}
      .tw-stale{font-size:9px;color:#B9770E;margin-top:3px}
      .tw-panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:22px;box-shadow:var(--shadow);margin-bottom:22px}
      .tw-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:15px}
      .tw-title{font-size:16px;font-weight:800}.tw-sub{font-size:10.5px;color:var(--muted);margin-top:3px}
      .tw-updated{font-size:9.5px;color:var(--muted);text-align:right}
      .tw-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .tw-country{border:1px solid var(--line);background:var(--panel2);border-radius:10px;padding:12px}
      .tw-country-head{display:flex;justify-content:space-between;gap:8px}
      .tw-country-name{font-size:12px;font-weight:800}.tw-rate{font:800 16px var(--mono)}
      .tw-label{font-size:10.5px;line-height:1.45;margin-top:6px}
      .tw-detail{font-size:9.5px;color:var(--muted);line-height:1.5;margin-top:7px}
      .tw-pending{font-size:9.5px;color:#B9770E;margin-top:6px}
      .tw-source{font-size:9px;margin-top:5px}.tw-source a{color:var(--muted);text-decoration:underline}
      .tw-note{margin-top:12px;padding:10px 12px;background:var(--accent-tint);border-radius:8px;font-size:10.5px;line-height:1.55}
      @media(max-width:850px){.tw-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:550px){.tw-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }
  function src(row){
    return (row.sources||[]).slice(0,2).map(s=>`<a href="${s.url}" target="_blank" rel="noopener">${s.title||"Official source"}</a>`).join(" · ");
  }
  function renderSidebar(d){
    const list=document.getElementById("tariff-list"),foot=document.getElementById("tariff-footnote");
    if(!list)return;
    list.innerHTML=d.countries.map(x=>`
      <div class="cop-row ${x.status==="CURRENT"?"ok":""}">
        <div class="cop-top">
          <span class="cop-name">${x.country}<span class="tw-status ${cls(x.status)}">${x.status}</span></span>
          <span class="cop-rate">${fmtRate(x.currentAdditionalRate)}</span>
        </div>
        <div class="cop-note">${isEn()?x.currentLabelEn:x.currentLabelKr}</div>
        ${x.pending?.length?`<div class="tw-pending">${isEn()?"Pending":"예정"}: ${x.pending.map(p=>`${p.effectiveDate||"TBD"} ${p.rate==null?"":`+${p.rate}%`}`).join(", ")}</div>`:""}
      </div>`).join("");

    if(foot){
      const stale=d.stale
        ? `<div class="tw-stale">${isEn()?"Latest daily refresh failed; showing last verified data.":"오늘 재확인 실패로 마지막 검증 데이터를 표시 중입니다."}</div>`
        :"";
      foot.innerHTML=(isEn()
        ? `Last verified: <b>${new Date(d.asOf).toLocaleString()}</b> · MFN/base duty excluded`
        : `마지막 검증: <b>${new Date(d.asOf).toLocaleString()}</b> · MFN/기본 HTS 관세 제외`)+stale;
    }
  }
  function renderMain(d){
    installStyle();
    let p=document.getElementById("daily-tariff-watch");
    if(!p){
      p=document.createElement("section");p.id="daily-tariff-watch";p.className="tw-panel";
      document.getElementById("action")?.insertAdjacentElement("beforebegin",p);
    }
    p.innerHTML=`
      <div class="tw-head">
        <div>
          <div class="tw-title"><span class="kr">DAILY 관세 WATCH</span><span class="en">DAILY TARIFF WATCH</span></div>
          <div class="tw-sub"><span class="kr">MFN/기본 HTS 제외 · 현재 적용 추가관세 · 하루 1회 공식 검증</span><span class="en">MFN/base HTS excluded · current additional duties · verified once daily</span></div>
          ${d.stale?`<div class="tw-stale">${isEn()?"Refresh quota unavailable — last verified result retained.":"오늘 검증 quota 사용 불가 — 마지막 검증 결과를 유지합니다."}</div>`:""}
        </div>
        <div class="tw-updated">${new Date(d.asOf).toLocaleString()}</div>
      </div>
      <div class="tw-grid">
      ${d.countries.map(x=>{
        const detail=[];
        if(x.preference?.program)detail.push(`${x.preference.program}: ${x.preference.status}`);
        if(x.trq?.status && !["","NONE"].includes(x.trq.status))detail.push(`TRQ: ${x.trq.status}`);
        return `<div class="tw-country">
          <div class="tw-country-head"><div class="tw-country-name">${x.country}<span class="tw-status ${cls(x.status)}">${x.status}</span></div><div class="tw-rate">${fmtRate(x.currentAdditionalRate)}</div></div>
          <div class="tw-label">${isEn()?x.currentLabelEn:x.currentLabelKr}</div>
          ${detail.length?`<div class="tw-detail">${detail.join(" · ")}</div>`:""}
          ${x.pending?.length?`<div class="tw-pending">${isEn()?"Future/Pending":"향후/예정"}: ${x.pending.map(p=>`${p.name} ${p.effectiveDate||"TBD"}`).join(" · ")}</div>`:""}
          ${src(x)?`<div class="tw-source">${src(x)}</div>`:""}
        </div>`;
      }).join("")}
      </div>
      <div class="tw-note">
        <span class="kr">CURRENT만 현재 추가관세에 포함합니다. PENDING은 시행 전이므로 제외하며, VERIFY는 공식 문서상 현재 적용을 확정하지 못한 경우입니다. 실제 PO/Entry 확정 전 HTS 및 Chapter 99를 별도 확인하세요.</span>
        <span class="en">Only CURRENT items are included in the headline additional-duty rate. PENDING is excluded until effective; VERIFY means current implementation could not be confirmed. Confirm HTS and Chapter 99 before final PO/entry costing.</span>
      </div>`;

    // Hide stale hard-coded tariff cards.
    document.querySelectorAll(".action-card").forEach(card=>{
      const t=card.innerText||"";
      if(t.includes("CAFTA-DR 적격시 관세")||t.includes("아이티 — 60개국")||t.includes("베트남 — TRQ")||
         t.includes("Fully Exempt If CAFTA")||t.includes("Haiti — Not on the 60")||t.includes("Vietnam — Not TRQ")){
        card.style.display="none";
      }
    });
  }
  function render(){if(!last)return;renderSidebar(last);renderMain(last);}
  async function load(){
    try{
      const r=await fetch("/api/tariff",{cache:"no-store"}),j=await r.json();
      if(!r.ok)throw new Error(j.error||`Tariff API ${r.status}`);
      last=j;render();window.__DAILY_TARIFF__=j;
    }catch(e){
      console.error("[Tariff]",e);
      const f=document.getElementById("tariff-footnote");
      if(f)f.textContent=(isEn()?"Tariff data unavailable: ":"관세 데이터 조회 실패: ")+e.message;
    }
  }

  const old=window.setLang;
  if(typeof old==="function"){
    window.setLang=function(lang){old(lang);render();};
  }

  load();
  // The API itself suppresses Gemini calls for 24h, so this is safe.
  setInterval(load,6*60*60*1000);
})();
