// File: /news-client.js
// KST 08:00 saved news snapshot + robust brand-filter normalization.
// Fixes brand chips when API data returns display labels such as "Kohl's"
// while index.html filters use internal keys such as "kohls".

(()=>{
  function en(){return document.body.classList.contains("en");}

  function label(j){
    const date=j.generatedDateKST||"";
    return en()
      ? `KST 08:00 daily feed · ${date} · ${j.freshness?.within72h||0} within 72h · ${j.freshness?.within7d||0} within 7d`
      : `KST 08:00 Daily 뉴스 · ${date} · 72시간 이내 ${j.freshness?.within72h||0}건 · 7일 이내 ${j.freshness?.within7d||0}건`;
  }

  function normText(v){
    return String(v||"")
      .toLowerCase()
      .replace(/&amp;/g,"&")
      .replace(/[’‘`]/g,"'")
      .replace(/[^a-z0-9&]+/g," ")
      .replace(/\s+/g," ")
      .trim();
  }

  function brandKey(item){
    // Prefer whichever field contains the most useful display value.
    const candidates=[
      item?.brand,
      item?.brandLabel,
      item?.searchKey,
      item?.searchLabel
    ].map(normText).filter(Boolean);

    const s=candidates.join(" | ");

    if(/\bkohl'?s\b|\bkohls\b/.test(s)) return "kohls";

    if(
      /abercrombie/.test(s) ||
      /\bhollister\b/.test(s) ||
      /\ba&f\b/.test(s) ||
      /\baf\b/.test(s)
    ) return "af";

    if(/\bmacy'?s\b|\bmacys\b/.test(s)) return "macys";

    if(/\bann taylor\b|\banntaylor\b/.test(s)) return "anntaylor";

    if(/\btalbot'?s\b|\btalbots\b/.test(s)) return "talbots";

    // Non-filtered editorial buckets still show under "All".
    if(/\bpair of thieves\b/.test(s)) return "pairofthieves";
    if(/\bindustry\b/.test(s)) return "industry";
    if(/\bproduct trend\b|\bproduct\b/.test(s)) return "product";

    // Preserve an existing compact key when possible.
    const raw=normText(item?.brand);
    return raw.replace(/\s+/g,"") || "other";
  }

  function normalizeItem(item){
    const display =
      item?.brandLabel ||
      item?.searchLabel ||
      item?.brand ||
      "Industry";

    return {
      ...item,
      brand: brandKey(item),
      brandLabel: display
    };
  }

  function activeFilter(){
    return document.querySelector("#filter-row .chip.active")?.dataset?.f || "all";
  }

  async function load(){
    try{
      const r=await fetch(`/api/news?t=${Date.now()}`,{cache:"no-store"});
      const j=await r.json();
      if(!r.ok||!j.items?.length)return;

      const normalized=j.items.map(normalizeItem);

      if(typeof CONFIG!=="undefined") CONFIG.news=normalized;

      // Keep the user's currently selected brand instead of resetting to All.
      const current=activeFilter();
      if(typeof renderNews==="function") renderNews(current);

      let m=document.getElementById("fresh-news-status");
      if(!m){
        m=document.createElement("div");
        m.id="fresh-news-status";
        m.style.cssText="font-size:10px;color:var(--muted);margin:-10px 0 12px;";
        document.getElementById("news-panel")?.insertAdjacentElement("beforebegin",m);
      }
      m.textContent=label(j);

      window.__FRESH_NEWS__=normalized;
    }catch(e){
      console.error("[Daily News]",e);
    }
  }

  // Language changes should not wipe out the selected brand.
  const old=window.setLang;
  if(typeof old==="function"){
    window.setLang=function(lang){
      old(lang);
      load();
    };
  }

  load();
})();
