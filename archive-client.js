// File: archive-client.js
// Visible "지난 브리프" editions at the bottom + current edition number.
// 2026-08-13 is Issue #1 (창간호).

(()=>{
  const LAUNCH="2026-08-13";
  const DAY=86400000;
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const lang=()=>document.body.classList.contains("en")?"en":"kr";
  function kstDate(){
    return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  }
  function issueNo(date){
    const a=Date.parse(LAUNCH+"T00:00:00Z"),b=Date.parse(date+"T00:00:00Z");
    return Math.max(1,Math.floor((b-a)/DAY)+1);
  }
  function issueLabel(date){
    const n=issueNo(date);
    if(lang()==="en") return n===1?"Launch Issue":`Issue #${n}`;
    return n===1?"창간호":`제${n}호`;
  }
  function addStyles(){
    if(document.getElementById("edition-archive-style"))return;
    const s=document.createElement("style");s.id="edition-archive-style";
    s.textContent=`
      .edition-current{font-size:10px;color:var(--muted);margin-top:7px;font-weight:700}
      .past-briefs{border-top:1px solid var(--line);margin-top:34px;padding:25px 0 6px}
      .past-head{display:flex;justify-content:space-between;align-items:end;gap:12px;margin-bottom:13px}
      .past-kicker{font-size:10px;color:var(--accent);font-weight:800;letter-spacing:.08em}
      .past-title{font-size:18px;font-weight:850;margin-top:3px}.past-sub{font-size:10px;color:var(--muted)}
      .past-list{display:grid;gap:10px}
      .past-card{display:grid;grid-template-columns:92px 1fr auto;gap:14px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;box-shadow:var(--shadow)}
      .past-card:hover{border-color:var(--accent)}.past-date{font:750 11px var(--mono);color:var(--muted)}
      .past-issue{font-size:13px;font-weight:850;margin-top:3px}.past-summary{font-size:11px;color:var(--muted);margin-top:4px;line-height:1.5}
      .past-open{font-size:11px;font-weight:800;color:var(--accent);white-space:nowrap}
      @media(max-width:700px){.past-card{grid-template-columns:76px 1fr}.past-open{grid-column:2}}
    `;document.head.appendChild(s);
  }
  async function getIndex(){
    const r=await fetch("/api/archive",{cache:"no-store"}); if(!r.ok)return[];
    const j=await r.json();return Array.isArray(j.dates)?j.dates:[];
  }
  async function getEdition(date){
    try{const r=await fetch(`/api/archive?date=${encodeURIComponent(date)}`,{cache:"no-store"});return r.ok?await r.json():null}catch{return null}
  }
  function summary(x){
    const d=x?.ai?.insight;
    if(!d)return "";
    const h=lang()==="en"?(d.headline?.en||d.headline?.kr):(d.headline?.kr||d.headline?.en);
    return h||"";
  }
  async function render(){
    addStyles();
    const today=kstDate(), n=issueNo(today);
    const hero=document.querySelector(".hero-card");
    if(hero){
      let m=document.getElementById("edition-current");
      if(!m){m=document.createElement("div");m.id="edition-current";m.className="edition-current";hero.appendChild(m);}
      m.textContent=lang()==="en"?`${today} · Issue #${n} · KST 08:00 Daily Edition`:`${today} · ${issueLabel(today)} · KST 08:00 Daily Edition`;
    }

    // Correct launch-day hard-coded calendar "Today".
    if(typeof CONFIG!=="undefined"&&Array.isArray(CONFIG.calendar)){
      const md=`${Number(today.slice(5,7))}/${Number(today.slice(8,10))}`;
      CONFIG.calendar.forEach(c=>{
        c.isToday=c.date===md;
        if(c.isToday){c.label_kr="오늘";c.label_en="Today";}
        else if(c.label_kr==="오늘"||c.label_en==="Today"){c.label_kr="";c.label_en="";}
      });
      if(typeof renderCalendar==="function")renderCalendar();
    }

    const dates=(await getIndex()).filter(d=>d<today).sort().reverse();
    const footer=document.querySelector("footer")||document.querySelector(".footer")||document.body.lastElementChild;
    let sec=document.getElementById("past-briefs");
    if(!sec){sec=document.createElement("section");sec.id="past-briefs";sec.className="past-briefs";footer?.parentNode?.insertBefore(sec,footer)||document.body.appendChild(sec);}
    const editions=await Promise.all(dates.slice(0,60).map(async d=>({date:d,data:await getEdition(d)})));
    sec.innerHTML=`
      <div class="past-head"><div><div class="past-kicker">${lang()==="en"?"ARCHIVE":"지난 브리프"}</div><div class="past-title">${lang()==="en"?"Previous Daily Briefs":"지난 브리프"}</div></div><div class="past-sub">${lang()==="en"?"Daily editions accumulate here.":"매일 발행된 호가 아래에 계속 누적됩니다."}</div></div>
      <div class="past-list">${editions.map(x=>`
        <a class="past-card" href="/api/archive?date=${esc(x.date)}" target="_blank" style="text-decoration:none;color:inherit">
          <div><div class="past-date">${esc(x.date)}</div><div class="past-issue">${esc(issueLabel(x.date))}</div></div>
          <div><b>${esc(summary(x)|| (lang()==="en"?"Daily Market Brief":"8담당 DAILY MARKET BRIEF"))}</b><div class="past-summary">${lang()==="en"?"Saved Market · News · Gemini AI edition":"Market · News · Gemini AI 전체 저장본"}</div></div>
          <div class="past-open">${lang()==="en"?"Open →":"보기 →"}</div>
        </a>`).join("")||`<div class="past-sub">${lang()==="en"?"No previous issue yet.":"아직 지난 호가 없습니다."}</div>`}</div>`;
  }
  const old=window.setLang;
  if(typeof old==="function")window.setLang=function(x){old(x);render();};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",render,{once:true});else render();
})();
