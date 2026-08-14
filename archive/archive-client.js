// File: archive-client.js
// Visible "지난 브리프" archive.
// Data retention: 365 days server-side.
// UI: latest 30 first; +30 per click.
// Archive opens a human-readable archive page, not raw JSON.

(()=>{
  const LAUNCH="2026-08-13",DAY=86400000,PAGE_SIZE=30;
  let visibleCount=PAGE_SIZE,cachedEditions=[];
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const isEn=()=>document.body.classList.contains("en");
  function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
  function no(d){return Math.max(1,Math.floor((Date.parse(d+"T00:00:00Z")-Date.parse(LAUNCH+"T00:00:00Z"))/DAY)+1)}
  function label(d){const n=no(d);return isEn()?(n===1?"Launch Issue":`Issue #${n}`):(n===1?"창간호":`제${n}호`)}
  function style(){if(document.getElementById("edition-archive-style"))return;const s=document.createElement("style");s.id="edition-archive-style";s.textContent=`
    .edition-current{font-size:10px;color:var(--muted);margin-top:7px;font-weight:700}.past-briefs{border-top:1px solid var(--line);margin-top:34px;padding:25px 0 6px}
    .past-head{display:flex;justify-content:space-between;align-items:end;gap:12px;margin-bottom:13px}.past-kicker{font-size:10px;color:var(--accent);font-weight:800;letter-spacing:.08em}
    .past-title{font-size:18px;font-weight:850;margin-top:3px}.past-sub{font-size:10px;color:var(--muted)}.past-list{display:grid;gap:10px}
    .past-card{display:grid;grid-template-columns:92px 1fr auto;gap:14px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;box-shadow:var(--shadow)}
    .past-card:hover{border-color:var(--accent)}.past-date{font:750 11px var(--mono);color:var(--muted)}.past-issue{font-size:13px;font-weight:850;margin-top:3px}
    .past-summary{font-size:11px;color:var(--muted);margin-top:4px;line-height:1.5}.past-open{font-size:11px;font-weight:800;color:var(--accent);white-space:nowrap}
    .archive-more-wrap{text-align:center;margin-top:14px}.archive-more{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:9px;padding:9px 18px;font:750 11px var(--font);cursor:pointer}
    @media(max-width:700px){.past-card{grid-template-columns:76px 1fr}.past-open{grid-column:2}}`;document.head.appendChild(s)}
  async function index(){const r=await fetch("/api/archive",{cache:"no-store"});if(!r.ok)return[];return (await r.json()).dates||[]}
  async function ed(d){try{const r=await fetch(`/api/archive?date=${d}`,{cache:"no-store"});return r.ok?await r.json():null}catch{return null}}
  function sum(x){const d=x?.data?.ai?.insight;return isEn()?(d?.headline?.en||d?.headline?.kr||""):(d?.headline?.kr||d?.headline?.en||"")}
  function sec(){let s=document.getElementById("past-briefs");if(s)return s;s=document.createElement("section");s.id="past-briefs";s.className="past-briefs";(document.querySelector(".main-col")||document.body).appendChild(s);return s}
  function draw(){
    const shown=cachedEditions.slice(0,visibleCount),more=visibleCount<cachedEditions.length,s=sec();
    s.innerHTML=`<div class="past-head"><div><div class="past-kicker">${isEn()?"ARCHIVE":"지난 브리프"}</div><div class="past-title">${isEn()?"Previous Daily Briefs":"지난 브리프"}</div></div><div class="past-sub">${isEn()?"Latest 30 shown first · retained for 1 year":"최근 30호 우선 표시 · 1년간 보관"}</div></div>
    <div class="past-list">${shown.map(x=>`<a class="past-card" href="/archive.html?date=${esc(x.date)}" style="text-decoration:none;color:inherit"><div><div class="past-date">${esc(x.date)}</div><div class="past-issue">${esc(label(x.date))}</div></div><div><b>${esc(sum(x)||"8담당 DAILY MARKET BRIEF")}</b><div class="past-summary">${isEn()?"Saved Market · News · Gemini AI edition":"Market · News · Gemini AI 저장본"}</div></div><div class="past-open">${isEn()?"Open →":"보기 →"}</div></a>`).join("")}</div>
    ${more?`<div class="archive-more-wrap"><button class="archive-more" id="archive-more-btn">${isEn()?"Show 30 more":"이전 브리프 30호 더 보기"}</button></div>`:""}`;
    document.getElementById("archive-more-btn")?.addEventListener("click",()=>{visibleCount+=PAGE_SIZE;draw()})
  }
  async function load(){
    style();const t=today(),hero=document.querySelector(".hero-card");
    if(hero){let m=document.getElementById("edition-current");if(!m){m=document.createElement("div");m.id="edition-current";m.className="edition-current";hero.appendChild(m)}m.textContent=isEn()?`${t} · Issue #${no(t)} · KST 08:00 Daily Edition`:`${t} · ${label(t)} · KST 08:00 Daily Edition`}
    const ds=(await index()).filter(d=>d<t).sort().reverse();
    cachedEditions=await Promise.all(ds.map(async date=>({date,data:await ed(date)})));draw()
  }
  const old=window.setLang;if(typeof old==="function")window.setLang=function(x){old(x);draw()};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",load,{once:true});else load();
})();