// competitor-client.js
// Competitor cards + sidebar index entry + removes unused top search.
(()=>{
 let D,A="Kohl's";
 const en=()=>document.body.classList.contains("en"),p=x=>en()?(x?.en||x?.kr||""):(x?.kr||x?.en||""),e=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

 function chrome(){
   document.querySelector(".search-box")?.remove();
   const top=document.querySelector(".topbar");if(top)top.style.justifyContent="flex-end";
   const nav=document.querySelector(".side-nav");
   if(nav&&!nav.querySelector('a[href="#competitor-watch"]')){
     const a=document.createElement("a");a.href="#competitor-watch";
     a.innerHTML='<span class="ic">◎</span><span>Competitor Watch</span>';
     const links=[...nav.querySelectorAll("a")];
     const dir=links.find(x=>/direction|브랜드 방향|brand direction/i.test(x.textContent||""));
     dir?dir.insertAdjacentElement("afterend",a):nav.appendChild(a);
   }
 }

 function root(){let r=document.getElementById("competitor-watch");if(!r){r=document.createElement("section");r.id="competitor-watch";r.style.scrollMarginTop="80px";let g=document.querySelector(".dir-grid");g?g.insertAdjacentElement("afterend",r):(document.querySelector(".main-col")||document.body).appendChild(r)}return r}

 function draw(){
   chrome();
   let b=D?.buyers?.find(x=>x.buyer===A)||D?.buyers?.[0],r=root();if(!b)return;
   r.innerHTML=`<div class="sec-eyebrow">COMPETITOR WATCH</div><div class="sec-title">${en()?"Buyer Competitor Intelligence":"Buyer별 Competitor Intelligence"}</div><div class="sec-intro">${e(p(b.keyTakeaway))}</div><div class="filter-row">${D.buyers.map(x=>`<button class="chip ${x.buyer===b.buyer?"active":""}" data-b="${e(x.buyer)}">${e(x.buyer)}</button>`).join("")}</div><div class="dir-grid">${(b.competitors||[]).slice(0,3).map(c=>`<div class="dir-card"><h4>${e(c.name)}</h4><div class="dtag">${e(c.signal||"WATCH")}</div><b>MOVE</b><p>${e(p(c.move))}</p><div class="why-box"><span class="wlabel">WHY IT MATTERS</span>${e(p(c.whyItMatters))}</div><div class="action-box"><span class="alabel">TEAM 8 ACTION</span><p>${e(p(c.action))}</p></div><div class="source">${(c.sources||[]).slice(0,3).map(s=>`<a target="_blank" rel="noopener" href="${e(s.url)}">${e(s.source)} · ${e(s.sourceTier)} ↗</a>`).join(" · ")}</div></div>`).join("")}</div>`;
   r.querySelectorAll("[data-b]").forEach(x=>x.onclick=()=>{A=x.dataset.b;draw()});
 }

 async function load(){
   chrome();
   try{let r=await fetch("/api/competitors",{cache:"no-store"}),j=await r.json();if(!r.ok)throw Error(j.error||"Competitor load failed");D=j;draw()}
   catch(err){root().innerHTML=`<div class="sec-eyebrow">COMPETITOR WATCH</div><div class="sec-intro">${e(err.message)}</div>`}
 }
 document.readyState==="loading"?document.addEventListener("DOMContentLoaded",load):load();
})();