// File: /tariff-client.js
// Renders live DAILY TARIFF WATCH in the existing sidebar tariff card
// and a detailed panel in the main column.
// Refreshes every 6 hours while the page is open.

(()=>{
  let last=null;

  const isEn=()=>document.body.classList.contains("en");
  const fmtRate=r=>r==null?"VERIFY":`+${Number(r).toFixed(Number(r)%1?1:0)}%`;
  const statusClass=s=>s==="CURRENT"?"ok":s==="PENDING"?"pending":"verify";

  function installStyle(){
    if(document.getElementById("tariff-watch-style"))return;
    const s=document.createElement("style");s.id="tariff-watch-style";
    s.textContent=`
      .tw-status{font:700 8px var(--mono);border-radius:4px;padding:2px 5px;margin-left:5px}
      .tw-status.ok{color:var(--green);background:var(--green-tint)}
      .tw-status.pending{color:#B9770E;background:#FFF4DC}
      .tw-status.verify{color:var(--red);background:var(--red-tint)}
      .tw-source{font-size:9px;margin-top:4px}
      .tw-source a{color:var(--muted);text-decoration:underline}
      .tw-panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:22px;box-shadow:var(--shadow);margin-bottom:22px}
      .tw-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:15px}
      .tw-title{font-size:16px;font-weight:800}.tw-sub{font-size:10.5px;color:var(--muted);margin-top:3px}
      .tw-updated{font-size:9.5px;color:var(--muted);text-align:right}
      .tw-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .tw-country{border:1px solid var(--line);background:var(--panel2);border-radius:10px;padding:12px}
      .tw-country-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
      .tw-country-name{font-size:12px;font-weight:800}.tw-rate{font:800 16px var(--mono)}
      .tw-label{font-size:10.5px;line-height:1.45;margin-top:6px}
      .tw-detail{font-size:9.5px;color:var(--muted);line-height:1.5;margin-top:7px}
      .tw-pending{font-size:9.5px;color:#B9770E;margin-top:6px}
      .tw-note{margin-top:12px;padding:10px 12px;background:var(--accent-tint);border-radius:8px;font-size:10.5px;line-height:1.55}
      @media(max-width:850px){.tw-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:550px){.tw-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }

  function sourceLinks(row,max=2){
    return (row.sources||[]).slice(0,max).map(s=>
      `<a href="${s.url}" target="_blank" rel="noopener">${s.title||"Official source"}</a>`
    ).join(" · ");
  }

  function renderSidebar(data){
    const list=document.getElementById("tariff-list");
    const foot=document.getElementById("tariff-footnote");
    if(!list)return;

    list.innerHTML=data.countries.map(x=>`
      <div class="cop-row ${x.status==="CURRENT"?"ok":""}">
        <div class="cop-top">
          <span class="cop-name">${x.country}
            <span class="tw-status ${statusClass(x.status)}">${x.status}</span>
          </span>
          <span class="cop-rate">${fmtRate(x.currentAdditionalRate)}</span>
        </div>
        <div class="cop-note">${isEn()?x.currentLabelEn:x.currentLabelKr}</div>
        ${x.pending?.length?`<div class="tw-pending">${isEn()?"Pending":"예정"}: ${x.pending.map(p=>`${p.effectiveDate||"TBD"} ${p.rate==null?"":`+${p.rate}%`}`).join(", ")}</div>`:""}
      </div>
    `).join("");

    if(foot){
      foot.innerHTML=isEn()
        ? `Daily verification · MFN/base duty excluded · <b>${new Date(data.asOf).toLocaleString()}</b><br>Only official U.S. government sources are accepted.`
        : `Daily 확인 · MFN/기본 HTS 관세 제외 · <b>${new Date(data.asOf).toLocaleString()}</b><br>미국 정부 공식 소스만 반영`;
    }

    const title=list.closest(".r-card")?.querySelector(".r-title");
    if(title)title.innerHTML=`<span class="kr">DAILY 관세 Watch · 우리 COP 9곳</span><span class="en">DAILY Tariff Watch · 9 COPs</span>`;
  }

  function renderMain(data){
    installStyle();
    let panel=document.getElementById("daily-tariff-watch");
    if(!panel){
      panel=document.createElement("section");
      panel.id="daily-tariff-watch";
      panel.className="tw-panel";
      // Place directly before Trend Radar.
      const eyebrow=document.getElementById("action");
      eyebrow?.insertAdjacentElement("beforebegin",panel);
    }

    panel.innerHTML=`
      <div class="tw-head">
        <div>
          <div class="tw-title"><span class="kr">DAILY 관세 WATCH</span><span class="en">DAILY TARIFF WATCH</span></div>
          <div class="tw-sub">
            <span class="kr">MFN/기본 HTS 관세 제외 · 현재 실제 적용되는 추가관세만 표시</span>
            <span class="en">MFN/base HTS duty excluded · current effective additional duties only</span>
          </div>
        </div>
        <div class="tw-updated">${new Date(data.asOf).toLocaleString()}</div>
      </div>
      <div class="tw-grid">
        ${data.countries.map(x=>{
          const pref=x.preference||{}, trq=x.trq||{};
          const details=[];
          if(pref.program)details.push(`${pref.program}: ${pref.status}`);
          if(trq.status && !["NONE",""].includes(trq.status))details.push(`TRQ: ${trq.status}`);
          return `
            <div class="tw-country">
              <div class="tw-country-head">
                <div class="tw-country-name">${x.country}<span class="tw-status ${statusClass(x.status)}">${x.status}</span></div>
                <div class="tw-rate">${fmtRate(x.currentAdditionalRate)}</div>
              </div>
              <div class="tw-label">${isEn()?x.currentLabelEn:x.currentLabelKr}</div>
              ${details.length?`<div class="tw-detail">${details.join(" · ")}</div>`:""}
              ${x.pending?.length?`<div class="tw-pending">${isEn()?"Future / pending":"향후/예정"}: ${x.pending.map(p=>`${p.name} ${p.effectiveDate||"TBD"}`).join(" · ")}</div>`:""}
              ${sourceLinks(x)?`<div class="tw-source">${sourceLinks(x)}</div>`:""}
            </div>`;
        }).join("")}
      </div>
      <div class="tw-note">
        <span class="kr">※ CURRENT만 현재 추가관세에 포함합니다. PENDING은 시행 전이므로 현재 세율에 포함하지 않으며, VERIFY는 공식 문서로 현재 적용 상태를 확정하지 못한 경우입니다. FTA/HOPE·HELP 등 특혜는 기본/MFN 관세와 별도 표시합니다.</span>
        <span class="en">※ Only CURRENT items are included in the current additional-duty rate. PENDING is excluded until effective; VERIFY means current implementation could not be confirmed from official sources. FTA/HOPE-HELP preferences are shown separately from MFN/base duty.</span>
      </div>`;

    // Hide stale tariff-specific static Trend Radar cards to avoid contradiction.
    document.querySelectorAll(".action-card").forEach(card=>{
      const t=card.innerText||"";
      if(
        t.includes("CAFTA-DR 적격시 관세") ||
        t.includes("아이티 — 60개국") ||
        t.includes("베트남 — TRQ") ||
        t.includes("Fully Exempt If CAFTA") ||
        t.includes("Haiti — Not on the 60") ||
        t.includes("Vietnam — Not TRQ")
      ){
        card.style.display="none";
      }
    });
  }

  function render(){
    if(!last)return;
    renderSidebar(last);
    renderMain(last);
  }

  async function load(){
    try{
      const r=await fetch("/api/tariff",{cache:"no-store"});
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||`Tariff API ${r.status}`);
      last=j;render();
      window.__DAILY_TARIFF__=j;
    }catch(e){
      console.error("[Daily Tariff Watch]",e);
      const foot=document.getElementById("tariff-footnote");
      if(foot)foot.textContent=(isEn()?"Daily tariff verification failed: ":"Daily 관세 확인 실패: ")+e.message;
    }
  }

  // Re-render bilingual strings when site language changes.
  const oldSetLang=window.setLang;
  if(typeof oldSetLang==="function"){
    window.setLang=function(lang){
      oldSetLang(lang);
      render();
    };
  }

  load();
  setInterval(load,6*60*60*1000);
})();
