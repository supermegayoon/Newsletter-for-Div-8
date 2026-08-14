// File: archive-client.js
// Visible "지난 브리프" archive.
// Data retention: 365 days server-side.
// UI: show latest 30 editions first, then "더 보기" in batches of 30.
// 2026-08-13 = 창간호 / Issue #1.

(()=>{
  const LAUNCH="2026-08-13";
  const DAY=86400000;
  const PAGE_SIZE=30;
  let visibleCount=PAGE_SIZE;
  let cachedDates=[];
  let cachedEditions=[];

  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  const isEn=()=>document.body.classList.contains("en");

  function kstDate(){
    return new Intl.DateTimeFormat("en-CA",{
      timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"
    }).format(new Date());
  }

  function issueNo(date){
    const a=Date.parse(LAUNCH+"T00:00:00Z");
    const b=Date.parse(date+"T00:00:00Z");
    return Math.max(1,Math.floor((b-a)/DAY)+1);
  }

  function issueLabel(date){
    const n=issueNo(date);
    if(isEn()) return n===1 ? "Launch Issue" : `Issue #${n}`;
    return n===1 ? "창간호" : `제${n}호`;
  }

  function addStyles(){
    if(document.getElementById("edition-archive-style"))return;
    const s=document.createElement("style");
    s.id="edition-archive-style";
    s.textContent=`
      .edition-current{font-size:10px;color:var(--muted);margin-top:7px;font-weight:700}
      .past-briefs{border-top:1px solid var(--line);margin-top:34px;padding:25px 0 6px}
      .past-head{display:flex;justify-content:space-between;align-items:end;gap:12px;margin-bottom:13px}
      .past-kicker{font-size:10px;color:var(--accent);font-weight:800;letter-spacing:.08em}
      .past-title{font-size:18px;font-weight:850;margin-top:3px}
      .past-sub{font-size:10px;color:var(--muted)}
      .past-list{display:grid;gap:10px}
      .past-card{display:grid;grid-template-columns:92px 1fr auto;gap:14px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;box-shadow:var(--shadow)}
      .past-card:hover{border-color:var(--accent)}
      .past-date{font:750 11px var(--mono);color:var(--muted)}
      .past-issue{font-size:13px;font-weight:850;margin-top:3px}
      .past-summary{font-size:11px;color:var(--muted);margin-top:4px;line-height:1.5}
      .past-open{font-size:11px;font-weight:800;color:var(--accent);white-space:nowrap}
      .archive-more-wrap{text-align:center;margin-top:14px}
      .archive-more{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:9px;padding:9px 18px;font:750 11px var(--font);cursor:pointer}
      .archive-more:hover{border-color:var(--accent);color:var(--accent)}
      .archive-count{font-size:9.5px;color:var(--muted);margin-top:7px}
      @media(max-width:700px){.past-card{grid-template-columns:76px 1fr}.past-open{grid-column:2}}
    `;
    document.head.appendChild(s);
  }

  async function getIndex(){
    const r=await fetch("/api/archive",{cache:"no-store"});
    if(!r.ok)return[];
    const j=await r.json();
    return Array.isArray(j.dates)?j.dates:[];
  }

  async function getEdition(date){
    try{
      const r=await fetch(`/api/archive?date=${encodeURIComponent(date)}`,{cache:"no-store"});
      return r.ok?await r.json():null;
    }catch{return null;}
  }

  function summary(x){
    const d=x?.ai?.insight;
    if(!d)return "";
    return isEn()
      ? (d.headline?.en||d.headline?.kr||"")
      : (d.headline?.kr||d.headline?.en||"");
  }

  function ensureSection(){
    let sec=document.getElementById("past-briefs");
    if(sec)return sec;

    sec=document.createElement("section");
    sec.id="past-briefs";
    sec.className="past-briefs";

    // Insert at the end of the main content, just before the footer/disclaimer area when possible.
    const mainCol=document.querySelector(".main-col");
    if(mainCol) mainCol.appendChild(sec);
    else document.body.appendChild(sec);

    return sec;
  }

  function renderCards(){
    const sec=ensureSection();
    const shown=cachedEditions.slice(0,visibleCount);
    const hasMore=visibleCount<cachedEditions.length;

    sec.innerHTML=`
      <div class="past-head">
        <div>
          <div class="past-kicker">${isEn()?"ARCHIVE":"지난 브리프"}</div>
          <div class="past-title">${isEn()?"Previous Daily Briefs":"지난 브리프"}</div>
        </div>
        <div class="past-sub">${isEn()
          ?"Latest 30 shown first · retained for 1 year"
          :"최근 30호 우선 표시 · 1년간 보관"}</div>
      </div>

      <div class="past-list">
        ${shown.map(x=>`
          <a class="past-card"
             href="/api/archive?date=${esc(x.date)}"
             target="_blank"
             style="text-decoration:none;color:inherit">
            <div>
              <div class="past-date">${esc(x.date)}</div>
              <div class="past-issue">${esc(issueLabel(x.date))}</div>
            </div>
            <div>
              <b>${esc(summary(x)|| (isEn()?"Daily Market Brief":"8담당 DAILY MARKET BRIEF"))}</b>
              <div class="past-summary">${isEn()
                ?"Saved Market · News · Gemini AI edition"
                :"Market · News · Gemini AI 전체 저장본"}</div>
            </div>
            <div class="past-open">${isEn()?"Open →":"보기 →"}</div>
          </a>
        `).join("") || `<div class="past-sub">${isEn()?"No previous issue yet.":"아직 지난 호가 없습니다."}</div>`}
      </div>

      ${hasMore?`
        <div class="archive-more-wrap">
          <button class="archive-more" id="archive-more-btn">
            ${isEn()?"Show 30 more":"이전 브리프 30호 더 보기"}
          </button>
          <div class="archive-count">
            ${isEn()
              ? `${Math.min(visibleCount,cachedEditions.length)} of ${cachedEditions.length} shown`
              : `총 ${cachedEditions.length}호 중 ${Math.min(visibleCount,cachedEditions.length)}호 표시`}
          </div>
        </div>
      `: cachedEditions.length?`
        <div class="archive-count" style="text-align:center;margin-top:12px">
          ${isEn()
            ? `All ${cachedEditions.length} archived editions shown`
            : `보관 중인 ${cachedEditions.length}개 지난 호를 모두 표시했습니다.`}
        </div>
      `:""}
    `;

    document.getElementById("archive-more-btn")?.addEventListener("click",()=>{
      visibleCount+=PAGE_SIZE;
      renderCards();
    });
  }

  async function loadArchive(){
    const today=kstDate();

    // Current issue label.
    const hero=document.querySelector(".hero-card");
    if(hero){
      let m=document.getElementById("edition-current");
      if(!m){
        m=document.createElement("div");
        m.id="edition-current";
        m.className="edition-current";
        hero.appendChild(m);
      }
      m.textContent=isEn()
        ? `${today} · Issue #${issueNo(today)} · KST 08:00 Daily Edition`
        : `${today} · ${issueLabel(today)} · KST 08:00 Daily Edition`;
    }

    // Fix hard-coded launch-day "Today".
    if(typeof CONFIG!=="undefined"&&Array.isArray(CONFIG.calendar)){
      const md=`${Number(today.slice(5,7))}/${Number(today.slice(8,10))}`;
      CONFIG.calendar.forEach(c=>{
        c.isToday=c.date===md;
        if(c.isToday){c.label_kr="오늘";c.label_en="Today";}
        else if(c.label_kr==="오늘"||c.label_en==="Today"){
          c.label_kr="";
          c.label_en="";
        }
      });
      if(typeof renderCalendar==="function")renderCalendar();
    }

    cachedDates=(await getIndex())
      .filter(d=>d<today)
      .sort()
      .reverse();

    // Load all retained edition summaries. The archive max is 365, which is small enough.
    cachedEditions=await Promise.all(
      cachedDates.map(async date=>({date,data:await getEdition(date)}))
    );

    renderCards();
  }

  addStyles();

  const old=window.setLang;
  if(typeof old==="function"){
    window.setLang=function(x){
      old(x);
      renderCards();
      loadArchive();
    };
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",loadArchive,{once:true});
  }else{
    loadArchive();
  }
})();
