// File: /news-client.js
// Auto-loads the latest 30-day curated feed and replaces stale CONFIG.news.

(()=>{
  function currentLang(){return document.body.classList.contains("en")?"en":"kr";}
  function statusText(j){
    const en=currentLang()==="en";
    return en
      ? `Fresh feed · ${j.freshness?.within72h||0} within 72h · ${j.freshness?.within7d||0} within 7d · 30-day window`
      : `최신 뉴스 · 72시간 이내 ${j.freshness?.within72h||0}건 · 7일 이내 ${j.freshness?.within7d||0}건 · 최대 30일`;
  }
  async function load(){
    try{
      const r=await fetch("/api/news",{cache:"no-store"});if(!r.ok)throw new Error(`news ${r.status}`);
      const j=await r.json();if(!Array.isArray(j.items)||!j.items.length)return;
      if(typeof CONFIG!=="undefined")CONFIG.news=j.items;
      if(typeof renderNews==="function")renderNews("all");
      let marker=document.getElementById("fresh-news-status");
      if(!marker){
        marker=document.createElement("div");marker.id="fresh-news-status";
        marker.style.cssText="font-size:10px;color:var(--muted);margin:-10px 0 12px;";
        document.getElementById("news-panel")?.insertAdjacentElement("beforebegin",marker);
      }
      marker.textContent=statusText(j);
      marker.dataset.updated=JSON.stringify(j.freshness||{});
      window.__FRESH_NEWS__=j.items;
    }catch(e){console.error("[Fresh News]",e);}
  }
  // Keep freshness label bilingual when the existing language toggle is used.
  const oldSetLang=window.setLang;
  if(typeof oldSetLang==="function"){
    window.setLang=function(lang){
      oldSetLang(lang);
      const m=document.getElementById("fresh-news-status");
      if(m&&m.dataset.updated){
        const f=JSON.parse(m.dataset.updated);
        m.textContent=lang==="en"
          ? `Fresh feed · ${f.within72h||0} within 72h · ${f.within7d||0} within 7d · 30-day window`
          : `최신 뉴스 · 72시간 이내 ${f.within72h||0}건 · 7일 이내 ${f.within7d||0}건 · 최대 30일`;
      }
    };
  }
  load();setInterval(load,30*60*1000);
})();
