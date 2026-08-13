// File: /news-client.js
// Everyone sees same daily cached news. Refreshes page data every 30 min, but Gemini is capped server-side to once/24h.

(()=>{
  function en(){return document.body.classList.contains("en");}
  function label(j){
    return en()
      ? `Daily shared feed · ${j.freshness?.within72h||0} within 72h · ${j.freshness?.within7d||0} within 7d · max 30 days`
      : `Daily 공용 뉴스 · 72시간 이내 ${j.freshness?.within72h||0}건 · 7일 이내 ${j.freshness?.within7d||0}건 · 최대 30일`;
  }
  async function load(){
    try{
      const r=await fetch("/api/news",{cache:"no-store"}),j=await r.json();
      if(!r.ok||!j.items?.length)return;
      if(typeof CONFIG!=="undefined")CONFIG.news=j.items;
      if(typeof renderNews==="function")renderNews("all");
      let m=document.getElementById("fresh-news-status");
      if(!m){
        m=document.createElement("div");m.id="fresh-news-status";
        m.style.cssText="font-size:10px;color:var(--muted);margin:-10px 0 12px;";
        document.getElementById("news-panel")?.insertAdjacentElement("beforebegin",m);
      }
      m.textContent=label(j);m.dataset.payload=JSON.stringify(j.freshness||{});
      window.__FRESH_NEWS__=j.items;
    }catch(e){console.error("[Daily News]",e);}
  }
  const old=window.setLang;
  if(typeof old==="function")window.setLang=function(lang){old(lang);load();};
  load();setInterval(load,30*60*1000);
})();
