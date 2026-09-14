// File: /competitor-client.js
// Competitor Watch + SOCIAL PULSE
// No index.html edit required.
// SOCIAL PULSE is inserted immediately before Competitor Watch.

(()=>{
 let D,A="Kohl's",S="all";

 const en=()=>document.body.classList.contains("en"),
 p=x=>en()?(x?.en||x?.kr||""):(x?.kr||x?.en||""),
 e=s=>String(s??"").replace(/[&<>"']/g,m=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
 }[m]));

 function chrome(){
  document.querySelector(".search-box")?.remove();
  const top=document.querySelector(".topbar");
  if(top)top.style.justifyContent="flex-end";

  const nav=document.querySelector(".side-nav");
  if(nav&&!nav.querySelector('a[href="#social-pulse"]')){
   const a=document.createElement("a");
   a.href="#social-pulse";
   a.innerHTML='<span class="ic">◉</span><span>Social Pulse</span>';
   const links=[...nav.querySelectorAll("a")];
   const competitor=links.find(x=>/competitor watch/i.test(x.textContent||""));
   competitor?competitor.insertAdjacentElement("beforebegin",a):nav.appendChild(a);
  }

  if(nav&&!nav.querySelector('a[href="#competitor-watch"]')){
   const a=document.createElement("a");a.href="#competitor-watch";
   a.innerHTML='<span class="ic">◎</span><span>Competitor Watch</span>';
   const links=[...nav.querySelectorAll("a")];
   const dir=links.find(x=>/direction|브랜드 방향|brand direction/i.test(x.textContent||""));
   dir?dir.insertAdjacentElement("afterend",a):nav.appendChild(a);
  }
 }

 function competitorRoot(){
  let r=document.getElementById("competitor-watch");
  if(!r){
   r=document.createElement("section");
   r.id="competitor-watch";
   r.style.scrollMarginTop="80px";
   let g=document.querySelector(".dir-grid");
   g?g.insertAdjacentElement("afterend",r):(document.querySelector(".main-col")||document.body).appendChild(r)
  }
  return r
 }

 function socialRoot(){
  let r=document.getElementById("social-pulse");
  if(!r){
   r=document.createElement("section");
   r.id="social-pulse";
   r.style.scrollMarginTop="80px";
   const c=competitorRoot();
   c.insertAdjacentElement("beforebegin",r);
  }
  return r
 }

 function socialStyle(){
  if(document.getElementById("social-pulse-style"))return;
  const s=document.createElement("style");
  s.id="social-pulse-style";
  s.textContent=`
   #social-pulse{margin-top:34px;margin-bottom:34px}
   .social-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:10px}
   .social-platform{font-size:10px;font-weight:800;letter-spacing:.05em;border:1px solid var(--line);border-radius:999px;padding:4px 8px}
   .social-platform.linkedin{background:#eef4ff}
   body.dark .social-platform.linkedin{background:rgba(66,110,200,.15)}
   .social-date{font-size:10px;color:var(--muted)}
   .social-brand{font-size:11px;font-weight:800;color:var(--accent)}
   .social-card h4{margin-top:4px}
   .social-card .social-summary{font-size:13.5px;line-height:1.65}
   .social-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}
   .social-smallbox{border-radius:9px;padding:11px 12px;background:var(--panel2);border:1px solid var(--line)}
   .social-smallbox b{display:block;font-size:9px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5px;color:var(--muted)}
   .social-smallbox p{font-size:12px;line-height:1.55;margin:0}
   .social-open{display:inline-block;margin-top:11px;font-size:10px}
   @media(max-width:700px){.social-actions{grid-template-columns:1fr}}
  `;
  document.head.appendChild(s)
 }

 function socialCard(x){
  const li=/linkedin/i.test(x.platform||"");
  return `<div class="dir-card social-card">
   <div class="social-meta">
    <span class="social-brand">${e(x.brand)}</span>
    <span class="social-platform ${li?"linkedin":""}">${e(x.platform||"Official")}</span>
    <span class="dtag">${e(x.signal||"SIGNAL")}</span>
    <span class="social-date">${e(x.date||"")}</span>
   </div>
   <h4>${e(p(x.headline))}</h4>
   <p class="social-summary">${e(p(x.summary))}</p>
   <div class="social-actions">
    <div class="social-smallbox"><b>WHY IT MATTERS</b><p>${e(p(x.whyItMatters))}</p></div>
    <div class="social-smallbox"><b>TEAM 8 ACTION</b><p>${e(p(x.action))}</p></div>
   </div>
   ${x.sourceUrl?`<a class="social-open" target="_blank" rel="noopener" href="${e(x.sourceUrl)}">${li?"LinkedIn":"Official source"} ↗</a>`:""}
  </div>`
 }

 function drawSocial(){
  socialStyle();
  const r=socialRoot(),all=D?.socialPulse?.items||[];
  const items=S==="all"?all:all.filter(x=>x.brand===S);

  if(!all.length){
   r.innerHTML=`<div class="sec-eyebrow">SOCIAL PULSE</div>
    <div class="sec-title">${en()?"Brand Social Signals":"브랜드 Social Signal"}</div>
    <div class="sec-intro">${en()?"No meaningful social signals were found in the current window.":"현재 기간 내 영업적으로 의미 있는 Social signal이 없습니다."}</div>`;
   return
  }

  const brands=["all","Kohl's","A&F / Hollister","Macy's"];

  r.innerHTML=`
   <div class="sec-eyebrow">SOCIAL PULSE</div>
   <div class="sec-title">${en()?"What the Brands Are Saying Now":"브랜드가 지금 직접 강조하는 것"}</div>
   <p class="sec-intro">${en()
    ?"Highlights commercially useful signals from Kohl's, A&F/Hollister and Macy's own social/corporate activity — filtered for product, collaboration, campaign, strategy and commercial direction."
    :"Kohl's · A&F/Hollister · Macy's의 LinkedIn/공식 활동 중 product, Collaboration, campaign, strategy 등 영업적으로 의미 있는 내용만 선별합니다."
   }</p>
   <div class="filter-row">
    ${brands.map(b=>`<button class="chip ${S===b?"active":""}" data-s="${e(b)}">${b==="all"?(en()?"All":"전체"):e(b)}</button>`).join("")}
   </div>
   <div class="dir-grid">${items.map(socialCard).join("")}</div>
   <div style="font-size:9px;color:var(--muted);margin-top:8px;">
    ${en()
     ?`Shared daily signal · ${e(D?.socialPulse?.generatedDateKST||D?.generatedDateKST||"")} · ${e(D?.socialPulse?.analysisMode||"")}`
     :`Daily 공용 Signal · ${e(D?.socialPulse?.generatedDateKST||D?.generatedDateKST||"")} · ${e(D?.socialPulse?.analysisMode||"")}`
    }
   </div>`;

  r.querySelectorAll("[data-s]").forEach(x=>x.onclick=()=>{
   S=x.dataset.s;drawSocial()
  })
 }

 function drawCompetitors(){
  chrome();
  let b=D?.buyers?.find(x=>x.buyer===A)||D?.buyers?.[0],r=competitorRoot();
  if(!b)return;

  r.innerHTML=`
   <div class="sec-eyebrow">COMPETITOR WATCH</div>
   <div class="sec-title">${en()?"Buyer Competitor Intelligence":"Buyer별 Competitor Intelligence"}</div>
   <div class="sec-intro">${e(p(b.keyTakeaway))}</div>
   <div class="filter-row">
    ${D.buyers.map(x=>`<button class="chip ${x.buyer===b.buyer?"active":""}" data-b="${e(x.buyer)}">${e(x.buyer)}</button>`).join("")}
   </div>
   <div class="dir-grid">
    ${(b.competitors||[]).slice(0,3).map(c=>`
     <div class="dir-card">
      <h4>${e(c.name)}</h4>
      <div class="dtag">${e(c.signal||"WATCH")}</div>
      <b>MOVE</b><p>${e(p(c.move))}</p>
      <div class="why-box"><span class="wlabel">WHY IT MATTERS</span>${e(p(c.whyItMatters))}</div>
      <div class="action-box"><span class="alabel">TEAM 8 ACTION</span><p>${e(p(c.action))}</p></div>
      <div class="source">${(c.sources||[]).slice(0,3).map(s=>`<a target="_blank" rel="noopener" href="${e(s.url)}">${e(s.source)} · ${e(s.sourceTier)} ↗</a>`).join(" · ")}</div>
     </div>`).join("")}
   </div>`;

  r.querySelectorAll("[data-b]").forEach(x=>x.onclick=()=>{
   A=x.dataset.b;drawCompetitors()
  })
 }

 function draw(){
  chrome();
  drawSocial();
  drawCompetitors()
 }

 async function load(){
  chrome();
  try{
   let r=await fetch("/api/competitors",{cache:"no-store"}),
   j=await r.json();
   if(!r.ok)throw Error(j.error||"Competitor load failed");
   D=j;draw()
  }catch(err){
   competitorRoot().innerHTML=`<div class="sec-eyebrow">COMPETITOR WATCH</div><div class="sec-intro">${e(err.message)}</div>`
  }
 }

 document.readyState==="loading"
  ?document.addEventListener("DOMContentLoaded",load)
  :load()
})();
