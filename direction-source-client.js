// File: direction-source-client.js
// Adds traceable source links to Brand Direction cards.

(()=>{
  const SOURCES={
    "Kohl's":[
      {label:"Kohl's SEC / 2026 Proxy",url:"https://www.sec.gov/Archives/edgar/data/885639/000110465926041769/kss-20260520xdef14a_c.pdf"}
    ],
    "A&F / Hollister":[
      {label:"A&F Corporate · Hollister x Target",url:"https://corporate.abercrombie.com/blog/the-hollister-collection-at-target/"}
    ],
    "Macy's":[
      {label:"Macy's Investor Relations · Q1 2026",url:"https://www.macysinc.com/newsroom/news/news-details/2026/Macys-Inc--Reports-Strong-First-Quarter-2026-Results-and-Raises-Full-Year-Outlook/default.aspx"},
      {label:"Macy's · Bold New Chapter",url:"https://www.macysinc.com/newsroom/news/news-details/2026/Macys-Inc--and-Macys-Return-to-Annual-Comparable-Sales-Growth-Fourth-Quarter-and-Fiscal-Year-2025-Results-Exceed-Guidance/"}
    ],
    "Ann Taylor":[
      {label:"KnitWell Store Optimization · Schuckman Realty",url:"https://www.schuckmanrealty.com/knitwell-is-closing-stores-smart-landlords-should-be-smiling/"}
    ]
  };

  function addStyle(){
    if(document.getElementById("direction-source-style"))return;
    const s=document.createElement("style");
    s.id="direction-source-style";
    s.textContent=`
      .direction-sources{margin-top:12px;padding-top:10px;border-top:1px solid var(--line);display:flex;gap:7px;flex-wrap:wrap;align-items:center}
      .direction-source-label{font-size:9px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.05em}
      .direction-source-link{font-size:9.5px;color:var(--accent);font-weight:700;text-decoration:none}
      .direction-source-link:hover{text-decoration:underline}
    `;
    document.head.appendChild(s);
  }

  function apply(){
    addStyle();
    document.querySelectorAll(".dir-card").forEach(card=>{
      if(card.querySelector(".direction-sources"))return;
      const title=card.querySelector("h4")?.textContent?.trim();
      const sources=SOURCES[title];
      if(!sources?.length)return;

      const box=document.createElement("div");
      box.className="direction-sources";
      box.innerHTML=`<span class="direction-source-label">Source</span>`+
        sources.map((s,i)=>`<a class="direction-source-link" href="${s.url}" target="_blank" rel="noopener">${s.label} ↗</a>`).join(`<span style="color:var(--muted)">·</span>`);
      card.appendChild(box);
    });
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",apply,{once:true});
  else apply();
})();
