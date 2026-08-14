(()=>{
  const LAUNCH="2026-08-13",DAY=86400000;
  let data=null, lang="kr";
  const $=id=>document.getElementById(id);
  const pick=x=>lang==="en"?(x?.en||x?.kr||""):(x?.kr||x?.en||"");
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  function issueNo(date){return Math.max(1,Math.floor((Date.parse(date+"T00:00:00Z")-Date.parse(LAUNCH+"T00:00:00Z"))/DAY)+1)}
  function issueLabel(date){const n=issueNo(date);return lang==="en"?(n===1?"Launch Issue":`Issue #${n}`):(n===1?"창간호":`제${n}호`)}
  function pct(n){if(n==null||!Number.isFinite(Number(n)))return "—";n=Number(n);return `${n>0?"▲":n<0?"▼":""} ${Math.abs(n).toFixed(2)}%`}
  function cls(n){return Number(n)>0?"up":Number(n)<0?"down":""}
  function money(s,d){
    if(!d?.price&&d?.price!==0)return "—";
    if(s==="KRW=X")return `₩${Number(d.price).toLocaleString("ko-KR",{maximumFractionDigits:2})}`;
    if(s==="CTZ26.NYB")return `${Number(d.price).toFixed(2)} ¢/lb`;
    return `$${Number(d.price).toFixed(2)}`;
  }
  function render(){
    if(!data)return;
    const a=data.ai||{},i=a.insight||{},m=data.market?.data||{},news=data.news?.items||[];
    const marketDefs=[["KSS","Kohl's"],["ANF","A&F"],["M","Macy's"],["KRW=X","USD/KRW"],["CTZ26.NYB","U.S. Cotton"],["CL=F","WTI"]];
    $("app").innerHTML=`
      <section class="hero">
        <div class="eyebrow">8담당 DAILY MARKET BRIEF · ARCHIVE</div>
        <div class="issue">${esc(data.date)} · ${esc(issueLabel(data.date))}</div>
        <h1>${esc(pick(i.headline)||"8담당 DAILY MARKET BRIEF")}</h1>
        <div class="summary">${esc(pick(i.summary)|| (lang==="en"?"Saved daily edition.":"저장된 Daily Edition입니다."))}</div>
      </section>

      <div class="section-title">${lang==="en"?"Market Snapshot":"시장 스냅샷"}</div>
      <section class="panel"><div class="grid3">
        ${marketDefs.map(([s,l])=>{const d=m[s];return `<div class="market-card"><div class="label">${l}</div><div class="price">${money(s,d)}</div><div class="delta ${cls(d?.changePct)}">${pct(d?.changePct)}</div></div>`}).join("")}
      </div></section>

      <div class="section-title">Gemini AI Insight</div>
      <section class="panel">
        ${(i.buyerInsights||[]).map(x=>`<div class="ai-row"><div class="buyer">${esc(x.buyer)}</div><div class="body">${esc(pick(x))}</div></div>`).join("")||`<div class="empty">—</div>`}
        <div class="ai-row"><div class="buyer">${lang==="en"?"Risk":"Risk Level"} · ${esc(i.risk?.level||"—")}</div><div class="body">${esc(pick(i.risk))}</div></div>
      </section>

      <div class="section-title">${lang==="en"?"Action Checkpoints":"액션 체크포인트"}</div>
      <section class="panel">
        ${(i.actions||[]).map((x,n)=>`<div class="action-row"><div class="buyer">${String(n+1).padStart(2,"0")} · ${esc(x.owner||"Team 8")}</div><div class="body">${esc(pick(x))}</div></div>`).join("")||`<div class="empty">—</div>`}
      </section>

      <div class="section-title">${lang==="en"?"Brand News":"브랜드 뉴스"}</div>
      <section class="panel">
        ${news.map(n=>`<div class="news-card"><div class="meta">${esc(n.brandLabel||n.brand)} · ${esc(n.date||"")} · ${esc(lang==="en"?n.category_en:n.category_kr)}</div><div class="news-title">${esc(lang==="en"?n.title_en:n.title_kr)}</div><div class="body">${esc(lang==="en"?n.body_en:n.body_kr)}</div><div class="source">${n.sourceUrl?`<a href="${esc(n.sourceUrl)}" target="_blank" rel="noopener">${esc(n.source||"Source")}</a>`:esc(n.source||"")}</div></div>`).join("")||`<div class="empty">—</div>`}
      </section>
    `;
  }
  async function load(){
    const date=new URLSearchParams(location.search).get("date");
    if(!date){$("app").innerHTML='<div class="empty">날짜가 없습니다.</div>';return}
    try{
      const r=await fetch(`/api/archive?date=${encodeURIComponent(date)}`,{cache:"no-store"});
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||"Archive load failed");
      data=j;document.title=`${date} · ${issueLabel(date)} · 8담당 DAILY MARKET BRIEF`;render();
    }catch(e){$("app").innerHTML=`<div class="empty">${esc(e.message)}</div>`}
  }
  $("kr").onclick=()=>{lang="kr";render()};
  $("en").onclick=()=>{lang="en";render()};
  load();
})();