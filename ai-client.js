// File: ai-client.js
// Current KST daily AI edition. Also replaces the static hero with today's Gemini output.

(()=>{
  const CARD_ID="ai-insight-card",STYLE_ID="ai-insight-style";
  let lastInsight=null,lastResponse=null;
  const en=()=>document.body.classList.contains("en");
  const pick=x=>en()?(x?.en||x?.kr||""):(x?.kr||x?.en||"");
  function style(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement("style");s.id=STYLE_ID;
    s.textContent=`
      .ai-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px 22px;box-shadow:var(--shadow);margin:0 0 16px;position:relative;overflow:hidden}
      .ai-card:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--accent)}
      .ai-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.ai-title{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:800}
      .ai-badge{font:700 9px var(--mono);color:#fff;background:var(--accent);border-radius:5px;padding:3px 7px}.ai-refresh{border:1px solid var(--line);background:var(--panel2);color:var(--text);border-radius:8px;padding:7px 10px;font:700 11px var(--font);cursor:pointer}
      .ai-one{font-size:14px;font-weight:750;line-height:1.6;margin-bottom:15px}.ai-section{margin-top:13px}.ai-section-title{font-size:10px;font-weight:800;color:var(--muted);letter-spacing:.05em;margin-bottom:7px;text-transform:uppercase}
      .ai-row{font-size:12.5px;line-height:1.6;margin:5px 0}.ai-row b{font-weight:800}.ai-meta,.ai-cache-note{margin-top:7px;font-size:9.5px;color:var(--muted)}.ai-stale{color:#B9770E}.ai-error{color:var(--red)}
    `;document.head.appendChild(s);
  }
  function card(){
    let c=document.getElementById(CARD_ID);
    if(!c){const hero=document.querySelector(".hero-card");if(!hero)return null;c=document.createElement("section");c.id=CARD_ID;c.className="ai-card";c.innerHTML=`<div class="ai-head"><div class="ai-title"><span class="ai-badge">GEMINI AI</span><span class="ai-title-text"></span></div><button class="ai-refresh"></button></div><div class="ai-content"></div><div class="ai-meta"></div><div class="ai-cache-note"></div>`;hero.insertAdjacentElement("afterend",c);}
    c.querySelector(".ai-title-text").textContent=en()?"Team 8 AI Market Insight":"8담당 AI Market Insight";
    c.querySelector(".ai-refresh").textContent=en()?"Regenerate today's insight":"오늘 Insight 다시 생성";
    return c;
  }
  async function market(){try{const r=await fetch("/api/market",{cache:"no-store"});return r.ok?(await r.json()).data||{}:{}}catch{return{}}}
  async function news(){try{const r=await fetch("/api/news",{cache:"no-store"}),j=await r.json();return r.ok&&j.items?.length?j.items:[]}catch{return[]}}
  function hero(d){
    if(!d)return;
    const pairs=[["hero-headline-kr",d.headline?.kr],["hero-headline-en",d.headline?.en],["hero-body-kr",d.summary?.kr],["hero-body-en",d.summary?.en]];
    pairs.forEach(([id,v])=>{const el=document.getElementById(id);if(el&&v)el.textContent=v;});
    const tags=document.getElementById("hero-tags");if(tags&&Array.isArray(d.tags)&&d.tags.length)tags.innerHTML=d.tags.map(t=>`<span>${t}</span>`).join("");
  }
  function actions(d){const list=document.getElementById("check-list");if(!list)return;const a=(d.actions||[]).slice(0,4);if(a.length)list.innerHTML=a.map((x,i)=>`<li><span class="check-num">${String(i+1).padStart(2,"0")}</span><p><b style="margin-right:8px">${x.owner||"Team 8"}</b>${pick(x)}</p></li>`).join("");}
  function render(){
    const c=card();if(!c||!lastInsight)return;const d=lastInsight;hero(d);actions(d);
    c.querySelector(".ai-content").innerHTML=`<div class="ai-one">${pick(d.headline)||"—"}</div><div class="ai-section"><div class="ai-section-title">${en()?"Buyer Action Insights":"Buyer별 Action Insight"}</div>${(d.buyerInsights||[]).map(x=>`<div class="ai-row"><b>${x.buyer}</b> — ${pick(x)}</div>`).join("")||"—"}</div><div class="ai-section"><div class="ai-section-title">${en()?"Team 8 Sales Opportunities":"8담당 영업 기회"}</div>${(d.opportunities||[]).map(x=>`<div class="ai-row">• ${pick(x)}</div>`).join("")||"—"}</div><div class="ai-section"><div class="ai-section-title">Risk Level</div><div class="ai-row"><b>${d.risk?.level||"—"}</b> — ${pick(d.risk)}</div></div>`;
    c.querySelector(".ai-meta").textContent=`${lastResponse?.provider||"Google Gemini"} · ${lastResponse?.generatedDateKST||""} · KST 08:00 Daily`;
    c.querySelector(".ai-cache-note").textContent=lastResponse?.stale?(en()?"Previous saved insight retained.":"이전 저장 Insight 유지 중"):(en()?"Today's Gemini result":"오늘 Gemini 신규 생성 결과");
  }
  function apply(j){lastResponse=j;lastInsight=j.insight||null;render();}
  async function load(){const c=card();try{const r=await fetch(`/api/ai?t=${Date.now()}`,{cache:"no-store"}),j=await r.json();if(!r.ok)throw new Error(j.error||`AI ${r.status}`);apply(j);}catch(e){c.querySelector(".ai-content").innerHTML=`<div class="ai-error">${e.message}</div>`;}}
  async function refresh(){const c=card(),b=c.querySelector(".ai-refresh");b.disabled=true;try{const [m,n]=await Promise.all([market(),news()]);const r=await fetch("/api/ai?force=1",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({news:n,market:m,regenerate:true})});const j=await r.json();if(!r.ok)throw new Error(j.error||`AI ${r.status}`);apply(j);}catch(e){console.error(e);}finally{b.disabled=false;}}
  style();const c=card();c?.querySelector(".ai-refresh")?.addEventListener("click",refresh);
  const old=window.setLang;if(typeof old==="function")window.setLang=function(x){old(x);render();};
  load();
})();

if(!document.getElementById("archive-client-loader")){
  const s=document.createElement("script");s.id="archive-client-loader";s.src="/archive-client.js?v=20260814b";document.body.appendChild(s);
}
