// APPAREL tariff client: headline is apparel-effective treatment.
(()=>{
  let last=null; const en=()=>document.body.classList.contains("en");
  const rate=x=>x.apparelEffectiveRate ?? x.currentAdditionalRate;
  const fmt=x=>rate(x)==null?"VERIFY":`${Number(rate(x)).toFixed(Number(rate(x))%1?1:0)}%`;
  const cls=s=>s==="CURRENT"?"ok":s==="PENDING"?"pending":"verify";
  function style(){
    if(document.getElementById("tariff-watch-style"))return;
    const s=document.createElement("style");s.id="tariff-watch-style";
    s.textContent=`.tw-status{font:700 8px var(--mono);border-radius:4px;padding:2px 5px;margin-left:5px}.tw-status.ok{color:var(--green);background:var(--green-tint)}.tw-status.pending{color:#B9770E;background:#FFF4DC}.tw-status.verify{color:var(--red);background:var(--red-tint)}.tw-stale{font-size:9px;color:#B9770E;margin-top:3px}.tw-panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:22px;box-shadow:var(--shadow);margin-bottom:22px}.tw-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:15px}.tw-title{font-size:16px;font-weight:800}.tw-sub,.tw-updated{font-size:10px;color:var(--muted)}.tw-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.tw-country{border:1px solid var(--line);background:var(--panel2);border-radius:10px;padding:12px}.tw-country-head{display:flex;justify-content:space-between;gap:8px}.tw-country-name{font-size:12px;font-weight:800}.tw-rate{font:800 16px var(--mono)}.tw-label{font-size:10.5px;line-height:1.45;margin-top:6px}.tw-detail{font-size:9.5px;color:var(--muted);line-height:1.5;margin-top:7px}.tw-note{margin-top:12px;padding:10px 12px;background:var(--accent-tint);border-radius:8px;font-size:10.5px;line-height:1.55}@media(max-width:850px){.tw-grid{grid-template-columns:1fr 1fr}}@media(max-width:550px){.tw-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(s);
  }
  function render(){
    if(!last)return;style();
    const list=document.getElementById("tariff-list"),foot=document.getElementById("tariff-footnote");
    if(list)list.innerHTML=last.countries.map(x=>`<div class="cop-row ${x.status==="CURRENT"?"ok":""}"><div class="cop-top"><span class="cop-name">${x.country}<span class="tw-status ${cls(x.status)}">${x.status}</span></span><span class="cop-rate">${fmt(x)}</span></div><div class="cop-note">${en()?x.currentLabelEn:x.currentLabelKr}</div></div>`).join("");
    if(foot)foot.innerHTML=(en()?`Apparel tariff basis · Last verified: <b>${new Date(last.asOf).toLocaleString()}</b>`:`의류 관세 기준 · 마지막 검증: <b>${new Date(last.asOf).toLocaleString()}</b>`)+(last.stale?`<div class="tw-stale">${en()?"Daily refresh failed; last verified apparel result retained.":"오늘 재확인 실패 — 마지막 의류 관세 결과를 유지합니다."}</div>`:"");
    let p=document.getElementById("daily-tariff-watch");
    if(!p){p=document.createElement("section");p.id="daily-tariff-watch";p.className="tw-panel";document.getElementById("action")?.insertAdjacentElement("beforebegin",p);}
    p.innerHTML=`<div class="tw-head"><div><div class="tw-title">${en()?"DAILY APPAREL TARIFF WATCH":"DAILY 의류 관세 WATCH"}</div><div class="tw-sub">${en()?"Qualifying apparel basis · FTA/preference reflected · refreshed daily":"적격 의류 기준 · FTA/특혜관세 반영 · Daily 검증"}</div></div><div class="tw-updated">${new Date(last.asOf).toLocaleString()}</div></div><div class="tw-grid">${last.countries.map(x=>`<div class="tw-country"><div class="tw-country-head"><div class="tw-country-name">${x.country}<span class="tw-status ${cls(x.status)}">${x.status}</span></div><div class="tw-rate">${fmt(x)}</div></div><div class="tw-label">${en()?x.currentLabelEn:x.currentLabelKr}</div>${x.preference?.program?`<div class="tw-detail">${x.preference.program} · ${x.preference.status}</div>`:""}</div>`).join("")}</div><div class="tw-note">${en()?"Dashboard is now apparel-specific. 0% means qualifying apparel receives duty-free base treatment and no current country-wide additional duty is included in the headline. CAFTA-DR/HOPE/HELP eligibility depends on origin, program and quota rules. Final entry costing should still be checked by HTS/Chapter 98/99.":"이제 Dashboard는 의류 전용 기준입니다. 0%는 해당 특혜 프로그램 요건을 충족하는 의류의 기본관세가 Duty-Free이고, 현재 표시 대상 국가단위 추가관세가 없다는 의미입니다. CAFTA-DR/HOPE/HELP는 원산지·프로그램·쿼터 요건 충족이 필요하며 실제 Entry는 HTS/Chapter 98/99를 최종 확인해야 합니다."}</div>`;
  }
  async function load(){try{const r=await fetch("/api/tariff",{cache:"no-store"}),j=await r.json();if(!r.ok)throw new Error(j.error||r.status);last=j;render();}catch(e){console.error("[Apparel Tariff]",e)}}
  const old=window.setLang;if(typeof old==="function")window.setLang=function(l){old(l);render();};
  load();setInterval(load,6*60*60*1000);
})();