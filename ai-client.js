// File: /ai-client.js
// Bilingual Buyer Strategy AI + moves EXISTING action checkpoint panel under AI Insight.

(()=>{
  const CARD_ID="ai-insight-card",STYLE_ID="ai-insight-style";
  let lastInsight=null,lastMeta=null;

  function installStyle(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement("style");s.id=STYLE_ID;
    s.textContent=`
      .ai-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px 22px;box-shadow:var(--shadow);margin:0 0 16px;position:relative;overflow:hidden}
      .ai-card:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--accent)}
      .ai-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
      .ai-title{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:800}
      .ai-badge{font:700 9px var(--mono);color:#fff;background:var(--accent);border-radius:5px;padding:3px 7px}
      .ai-refresh{border:1px solid var(--line);background:var(--panel2);color:var(--text);border-radius:8px;padding:7px 10px;font:700 11px var(--font);cursor:pointer}
      .ai-refresh:disabled{opacity:.5}
      .ai-one{font-size:14px;font-weight:750;line-height:1.6;margin-bottom:15px}
      .ai-section{margin-top:13px}.ai-section-title{font-size:10px;font-weight:800;color:var(--muted);letter-spacing:.05em;margin-bottom:7px;text-transform:uppercase}
      .ai-row{font-size:12.5px;line-height:1.6;margin:5px 0}.ai-row b{font-weight:800}
      .ai-meta{margin-top:12px;font-size:9.5px;color:var(--muted)}.ai-error{color:var(--red);font-size:12px}
    `;document.head.appendChild(s);
  }
  const isEn=()=>document.body.classList.contains("en");
  const pick=(x)=>isEn()?(x?.en||x?.kr||""):(x?.kr||x?.en||"");

  function moveCheckpoint(card){
    const list=document.getElementById("check-list"),panel=list?.closest(".check-panel");
    if(panel&&card){card.insertAdjacentElement("afterend",panel);panel.style.marginBottom="16px";}
  }
  function createCard(){
    let card=document.getElementById(CARD_ID);
    if(!card){
      const hero=document.querySelector(".hero-card");if(!hero)return null;
      card=document.createElement("section");card.id=CARD_ID;card.className="ai-card";
      card.innerHTML=`
        <div class="ai-head">
          <div class="ai-title"><span class="ai-badge">GEMINI AI</span><span class="ai-title-text"></span></div>
          <button class="ai-refresh" type="button"></button>
        </div>
        <div class="ai-content"></div><div class="ai-meta"></div>`;
      hero.insertAdjacentElement("afterend",card);
    }
    updateStaticLabels(card);moveCheckpoint(card);return card;
  }
  function updateStaticLabels(card){
    if(!card)return;
    card.querySelector(".ai-title-text").textContent=isEn()?"Team 8 AI Market Insight":"8담당 AI Market Insight";
    card.querySelector(".ai-refresh").textContent=isEn()?"Analyze":"AI 분석";
    if(!lastInsight)card.querySelector(".ai-content").textContent=isEn()
      ?"Generate buyer strategy insights from the latest news and market data."
      :"최신 Buyer 뉴스와 시장 데이터를 기준으로 전략 Insight를 생성합니다.";
  }
  async function getMarket(){try{const r=await fetch("/api/market",{cache:"no-store"});return r.ok?(await r.json()).data||{}:{}}catch{return{}}}
  async function getNews(){try{const r=await fetch("/api/news",{cache:"no-store"});const j=await r.json();return r.ok&&j.items?.length?j.items:(CONFIG.news||[])}catch{return CONFIG.news||[]}}
  function render(){
    const card=createCard();if(!card||!lastInsight)return;
    const d=lastInsight,c=card.querySelector(".ai-content");
    const buyers=(d.buyerInsights||[]).map(x=>`<div class="ai-row"><b>${x.buyer}</b> — ${pick(x)}</div>`).join("");
    const opp=(d.opportunities||[]).map(x=>`<div class="ai-row">• ${pick(x)}</div>`).join("");
    c.innerHTML=`
      <div class="ai-one">${pick(d.headline)||"—"}</div>
      <div class="ai-section"><div class="ai-section-title">${isEn()?"Buyer Action Insights":"Buyer별 Action Insight"}</div>${buyers||"—"}</div>
      <div class="ai-section"><div class="ai-section-title">${isEn()?"Team 8 Sales Opportunities":"8담당 영업 기회"}</div>${opp||"—"}</div>
      <div class="ai-section"><div class="ai-section-title">Risk Level</div><div class="ai-row"><b>${d.risk?.level||"—"}</b> — ${pick(d.risk)}</div></div>`;
    renderActions(d);
    if(lastMeta)card.querySelector(".ai-meta").textContent=lastMeta;
  }
  function renderActions(d){
    const list=document.getElementById("check-list");if(!list)return;
    const arr=(d.actions||[]).slice(0,4);
    if(!arr.length){list.innerHTML=`<li><span class="check-num">01</span><p>${isEn()?"No clear action signal today.":"오늘의 명확한 액션 신호가 없습니다."}</p></li>`;return;}
    list.innerHTML=arr.map((x,i)=>`
      <li><span class="check-num">${String(i+1).padStart(2,"0")}</span>
      <p><b style="margin-right:8px">${x.owner||"Team 8"}</b>${pick(x)}</p></li>`).join("");
  }
  async function run(){
    const card=createCard(),btn=card?.querySelector(".ai-refresh"),content=card?.querySelector(".ai-content"),meta=card?.querySelector(".ai-meta");
    if(!card)return;btn.disabled=true;content.textContent=isEn()?"Analyzing latest buyer news…":"최신 Buyer 뉴스 분석 중…";meta.textContent="";
    try{
      const [market,news]=await Promise.all([getMarket(),getNews()]);
      const r=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        headline:CONFIG?.headline?.kr||"",summary:CONFIG?.summary?.kr||"",news,market
      })});
      const j=await r.json();if(!r.ok)throw new Error(j.error||`AI API ${r.status}`);
      lastInsight=j.insight||{};
      lastMeta=`${j.provider} · ${j.model} · ${news.length} news items · ${new Date(j.updatedAt).toLocaleString()}`;
      render();
    }catch(e){content.innerHTML=`<div class="ai-error">${isEn()?"AI analysis failed":"AI 분석 실패"}: ${e.message}</div>`;}
    finally{btn.disabled=false;}
  }

  installStyle();const card=createCard();card?.querySelector(".ai-refresh")?.addEventListener("click",run);

  // Wrap existing language toggle so AI insight + action checkpoints switch instantly.
  const originalSetLang=window.setLang;
  if(typeof originalSetLang==="function"){
    window.setLang=function(lang){
      originalSetLang(lang);
      updateStaticLabels(document.getElementById(CARD_ID));
      if(lastInsight)render();
    };
  }
})();
