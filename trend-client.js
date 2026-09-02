// File: /trend-client.js
// Replaces the hard-coded Trend Radar action cards in index.html
// with the shared daily /api/trend result.

(()=>{
  function findIntro(){
    const action=document.getElementById("action");
    if(!action)return null;
    let n=action.nextElementSibling;
    while(n){
      if(n.classList?.contains("sec-intro"))return n;
      if(n.id==="news")break;
      n=n.nextElementSibling;
    }
    return null;
  }

  function removeOldCards(intro){
    if(!intro)return;
    let n=intro.nextElementSibling;
    while(n&&n.id!=="news"){
      const next=n.nextElementSibling;
      if(n.classList?.contains("action-card"))n.remove();
      n=next;
    }
  }

  function card(x){
    const level=(x.level||"MEDIUM").toUpperCase();
    const badge=level==="HIGH"?"high":"med";
    return `
      <div class="action-card dynamic-trend-card">
        <div class="badge ${badge}">${level}</div>
        <h4><span class="kr">${x.title_kr||""}</span><span class="en">${x.title_en||""}</span></h4>
        <p class="kr">${x.body_kr||""}</p>
        <p class="en">${x.body_en||""}</p>
        <div class="action-box">
          <span class="alabel">Action</span>
          <p class="kr">${x.action_kr||""}</p>
          <p class="en">${x.action_en||""}</p>
        </div>
        ${x.sourceUrl?`<div class="source"><a href="${x.sourceUrl}" target="_blank" rel="noopener">${x.source||"Source"}</a>${x.date?` · ${x.date}`:""}</div>`:""}
      </div>`;
  }

  async function load(){
    const intro=findIntro();
    if(!intro)return;

    try{
      const r=await fetch(`/api/trend?_=${Date.now()}`,{cache:"no-store"});
      const j=await r.json();
      if(!r.ok||!j.items?.length)throw new Error(j.error||"No Trend Radar items");

      removeOldCards(intro);

      const wrap=document.createElement("div");
      wrap.id="dynamic-trend-radar";
      wrap.innerHTML=j.items.map(card).join("");

      intro.insertAdjacentElement("afterend",wrap);

      const note=document.createElement("div");
      note.style.cssText="font-size:9px;color:var(--muted);margin:-5px 0 12px;";
      note.innerHTML=`<span class="kr">Daily Trend Radar · ${j.generatedDateKST||""}${j.stale?" · 마지막 정상값 유지":""}</span>
                      <span class="en">Daily Trend Radar · ${j.generatedDateKST||""}${j.stale?" · last verified result retained":""}</span>`;
      intro.insertAdjacentElement("afterend",note);

    }catch(e){
      console.error("[Trend Radar]",e);
      // If dynamic refresh fails, leave the old static cards visible rather than blanking the section.
    }
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",load,{once:true});
  }else{
    load();
  }
})();
