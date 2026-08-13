// File: /archive-client.js
// Adds a compact archive selector and fixes the visible page date/calendar "Today" marker dynamically.

(()=>{
  function kstToday(){
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const o=Object.fromEntries(parts.map(p=>[p.type,p.value]));
    return {iso:`${o.year}-${o.month}-${o.day}`,short:`${Number(o.month)}/${Number(o.day)}`};
  }
  const today=kstToday();

  // data.js contains launch-day calendar text; do not let that permanently mark 8/13 as Today.
  if(typeof CONFIG!=="undefined"&&Array.isArray(CONFIG.calendar)){
    CONFIG.calendar.forEach(c=>{
      c.isToday=c.date===today.short;
      if(c.isToday){c.label_kr="오늘";c.label_en="Today";}
      else if(c.label_kr==="오늘"){c.label_kr="";c.label_en="";}
    });
    if(typeof renderCalendar==="function")renderCalendar();
  }

  // Current issue date label.
  const meta=document.getElementById("page-date");
  if(meta){
    meta.textContent=`${today.iso} · KST 08:00 Daily Edition`;
  }

  async function loadArchiveList(){
    try{
      const r=await fetch("/api/archive",{cache:"no-store"}),j=await r.json();
      if(!r.ok)return;
      const dates=j.dates||[];
      const header=document.querySelector(".page-header");if(!header)return;
      let box=document.getElementById("archive-box");
      if(!box){
        box=document.createElement("div");box.id="archive-box";
        box.style.cssText="margin-top:10px;font-size:11px;color:var(--muted);display:flex;gap:8px;align-items:center;flex-wrap:wrap";
        header.appendChild(box);
      }
      box.innerHTML=`<b>ARCHIVE</b> ${dates.slice(0,14).map(d=>`<a href="/api/archive?date=${d}" target="_blank" style="color:var(--accent);text-decoration:none">${d.slice(5).replace("-","/")}</a>`).join(" · ")}`;
    }catch(e){console.error("[Archive]",e);}
  }
  loadArchiveList();
})();
