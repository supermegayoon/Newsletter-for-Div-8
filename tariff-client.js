// File: /tariff-client.js
// Shared daily cached tariff UI.

(()=>{
  let last=null;const en=()=>document.body.classList.contains("en");
  const fmt=r=>r==null?"VERIFY":`+${Number(r).toFixed(Number(r)%1?1:0)}%`;
  const cls=s=>s==="CURRENT"?"ok":s==="PENDING"?"pending":"verify";
  function style(){
    if(document.getElementById("tariff-watch-style"))return;
    const s=document.createElement("style");s.id="tariff-watch-style";
    s.textContent=`
      .tw-status{font:700 8px var(--mono);border-radius:4px;padding:2px 5px;margin-left:5px}
      .tw-status.ok{color:var(--green);background:var(--green-tint)}.tw-status.pending{color:#B9770E;background:#FFF4DC}.tw-status.verify{color:var(--red);background:var(--red-tint)}
      .tw-stale{font-size:9px;color:#B9770E;margin-top:3px}.tw-panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:22px;box-shadow:var(--shadow);margin-bottom:22px}
      .tw-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:15px}.tw-title{font-size:16px;font-weight:800}.tw-sub{font-size:10.5px;color:var(--muted);margin-top:3px}
      .tw-updated{font-size:9.5px;color:var(--muted)}.tw-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.tw-country{border:1px solid var(--line);background:var(--panel2);border-radius:10px;padding:12px}
      .tw-country-head{display:flex;justify-content:space-between;gap:8px}.tw-country-name{font-size:12px;font-weight:800}.tw-rate{font:800 16px var(--mono)}
      .tw-label{font-size:10.5px;line-height:1.45;margin-top:6px}.tw-detail{font-size:9.5px;color:var(--muted);line-height:1.5;margin-top:7px}.tw-pending{font-size:9.5px;color:#B9770E;margin-top:6px}
      .tw-source{font-size:9px;margin-top:5px}.tw-source a{color:var(--muted);text-decoration:underline}.tw-note{margin-top:12px;padding:10px 12px;background:var(--accent-tint);border-radius:8px;font-size:10.5px;line-height:1.55}
      @media(max-width:850px){.tw-grid{grid-template-columns:1fr 1fr}}@media(max-width:550px){.tw-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }
  function src(x){return(x.sources||[]).slice(0,2).map(s=>`<a href="${s.url}" target="_blank" rel="noopener">${s.title||"Official source"}</a>`).join(" · ");}
  function sidebar(d){
    const list=document.getElementById("tariff-list"),foot=document.getElementById("tariff-footnote");if(!list)return;
    list.innerHTML=d.countries.map(x=>`<div class="cop-row ${x.status==="CURRENT"?"ok":""}"><div class="cop-top"><span class="cop-name">${x.country}<span class="tw-status ${cls(x.status)}">${x.status}</span></span><span class="cop-rate">${fmt(x.currentAdditionalRate)}</span></div><div class="cop-note">${en()?x.currentLabelEn:x.currentLabelKr}</div>${x.pending?.length?`<div class="tw-pending">${en()?"Pending":"예정"}: ${x.pending.map(p=>`${p.effectiveDate||"TBD"} ${p.rate==null?"":`+${p.rate}%`}`).join(", ")}</div>`:""}</div>`).join("");
    if(foot)foot.innerHTML=(en()?`Last verified: <b>${new Date(d.asOf).toLocaleString()}</b> · MFN/base duty excluded`:`마지막 검증: <b>${new Date(d.asOf).toLocaleString()}</b> · MFN/기본 HTS 제외`)+(d.stale?`<div class="tw-stale">${en()?"Daily refresh failed; last verified data retained.":"오늘 재확인 실패 — 마지막 검증 데이터를 유지합니다."}</div>`:"");
  }
  function main(d){
    style();let p=document.getElementById("daily-tariff-watch");
    if(!p){p=document.createElement("section");p.id="daily-tariff-watch";p.className="tw-panel";document.getElementById("action")?.insertAdjacentElement("beforebegin",p);}
    p.innerHTML=`<div class="tw-head"><div><div class="tw-title"><span class="kr">DAILY 관세 WATCH</span><span class="en">DAILY TARIFF WATCH</span></div><div class="tw-sub"><span class="kr">MFN/기본 HTS 제외 · 현재 적용 추가관세 · 하루 1회 공용 검증</span><span class="en">MFN/base HTS excluded · current additional duties · shared daily verification</span></div>${d.stale?`<div class="tw-stale">${en()?"Refresh unavailable — last result retained.":"오늘 검증 불가 — 마지막 결과를 유지합니다."}</div>`:""}</div><div class="tw-updated">${new Date(d.asOf).toLocaleString()}</div></div>
      <div class="tw-grid">${d.countries.map(x=>{const det=[];if(x.preference?.program)det.push(`${x.preference.program}: ${x.preference.status}`);if(x.trq?.status&&!["","NONE"].includes(x.trq.status))det.push(`TRQ: ${x.trq.status}`);return`<div class="tw-country"><div class="tw-country-head"><div class="tw-country-name">${x.country}<span class="tw-status ${cls(x.status)}">${x.status}</span></div><div class="tw-rate">${fmt(x.currentAdditionalRate)}</div></div><div class="tw-label">${en()?x.currentLabelEn:x.currentLabelKr}</div>${det.length?`<div class="tw-detail">${det.join(" · ")}</div>`:""}${x.pending?.length?`<div class="tw-pending">${en()?"Future/Pending":"향후/예정"}: ${x.pending.map(p=>`${p.name} ${p.effectiveDate||"TBD"}`).join(" · ")}</div>`:""}${src(x)?`<div class="tw-source">${src(x)}</div>`:""}</div>`;}).join("")}</div>
      <div class="tw-note"><span class="kr">CURRENT만 현재 추가관세에 포함합니다. PENDING은 시행 전 제외, VERIFY는 공식 문서로 확정 불가입니다. 실제 PO/Entry 전 HTS/Chapter 99를 확인하세요.</span><span class="en">Only CURRENT items are included. PENDING is excluded until effective; VERIFY means official evidence was insufficient. Confirm HTS/Chapter 99 before final PO/entry costing.</span></div>`;
  }
  function render(){if(last){sidebar(last);main(last);}}
  async function load(){try{const r=await fetch("/api/tariff",{cache:"no-store"}),j=await r.json();if(!r.ok)throw new Error(j.error||`Tariff ${r.status}`);last=j;render();}catch(e){console.error("[Tariff]",e);}}
  const old=window.setLang;if(typeof old==="function")window.setLang=function(lang){old(lang);render();};
  load();setInterval(load,6*60*60*1000);
})();
