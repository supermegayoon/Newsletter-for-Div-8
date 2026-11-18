// Social Intelligence: verified evidence and buyer interpretation, no unverified LinkedIn posts.
(function(){
  const profiles=[
    {id:"kohls",name:"Kohl's",social:"https://www.linkedin.com/company/kohls-department-stores/"},
    {id:"af",name:"A&F / Hollister",social:"https://www.linkedin.com/search/results/companies/?keywords=Abercrombie%20%26%20Fitch"},
    {id:"macys",name:"Macy's",social:"https://www.linkedin.com/search/results/companies/?keywords=Macy%27s"},
    {id:"anntaylor",name:"Ann Taylor",social:"https://www.linkedin.com/search/results/companies/?keywords=Ann%20Taylor"},
    {id:"talbots",name:"Talbot's",social:"https://www.linkedin.com/search/results/companies/?keywords=Talbots"}
  ];
  const root=document.getElementById("social-intelligence-panel");
  if(!root)return;
  let selected="kohls", news=[], competitors=null, nd="",cd="";
  const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm=x=>String(x||"").toLowerCase().replace(/[^a-z0-9]+/g,"");
  const same=(s,id)=>{
    const n=norm(s);
    if(id==="kohls")return n.includes("kohls");
    if(id==="af")return n.includes("abercrombie")||n.includes("hollister")||n==="af";
    if(id==="macys")return n.includes("macys");
    if(id==="anntaylor")return n.includes("anntaylor");
    if(id==="talbots")return n.includes("talbots");
    return false;
  };
  const safeUrl=x=>{try{const u=new URL(String(x||""));return ["https:","http:"].includes(u.protocol)?u.href:"";}catch{return""}};
  const textOf=(x,lang="kr")=>typeof x==="string"?x:(x?.[lang]||x?.en||"");
  function selectedBuyer(){
    const p=profiles.find(x=>x.id===selected);
    const b=(competitors?.buyers||[]).find(x=>same(x.buyer,selected));
    const n=news.filter(x=>same([x.brand,x.brandLabel].join(" "),selected));
    return {p,b,n};
  }
  function cardSource(s){
    const u=safeUrl(s?.url||s?.sourceUrl||s?.link);
    if(!u)return "";
    return '<a class="si-source-link" href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">↗ '+esc(s?.source||s?.name||"Source")+'</a>';
  }
  function render(){
    const {p,b,n}=selectedBuyer();
    const allSignals=(b?.competitors||[]).filter(x=>x?.move?.kr||x?.move?.en).slice(0,3);
    const posts=n.filter(x=>/linkedin\.com|instagram\.com|facebook\.com/.test(x.sourceUrl||""));
    root.innerHTML=
      '<div class="si-heading"><div><div class="si-eyebrow">SOCIAL INTELLIGENCE · BUYER SIGNAL MONITOR</div><h3>Official Social Watch & Business Implications</h3><p>공식 소셜 활동을 확인하고, 공개 기사·Competitor 근거를 통해 Buyer 전략을 해석합니다.</p></div><span class="si-live">Evidence-led</span></div>'+
      '<div class="si-tabs" role="tablist" aria-label="Buyer selection">'+profiles.map(x=>'<button type="button" role="tab" aria-selected="'+(x.id===selected)+'" class="si-tab'+(x.id===selected?' active':'')+'" data-social-buyer="'+x.id+'">'+esc(x.name)+'</button>').join("")+'</div>'+
      '<div class="si-stats"><div><strong>'+esc(p.name)+'</strong><small>Selected Buyer</small></div><div><strong>'+posts.length+'</strong><small>Linked social sources</small></div><div><strong>'+allSignals.length+'</strong><small>Competitor signals</small></div><div><strong>'+n.length+'</strong><small>Buyer news items</small></div></div>'+
      '<div class="si-note"><strong>Data provenance</strong> · 실제 LinkedIn 게시물 전문을 자동 수집하는 기능은 아직 연결되지 않았습니다. 아래 Competitor/News는 별도 공개 자료의 신호이며, 소셜 게시물로 표시하지 않습니다. Snapshot: News '+esc(nd||"—")+' · Competitor '+esc(cd||"—")+'</div>'+
      '<div class="si-grid"><section class="si-card"><div class="si-card-header"><strong>01 / Social Channel Watch</strong><span>Official / discovery</span></div><p class="si-card-desc">공식 채널에서 직접 확인할 최근 Campaign, Product Launch, Partnerships, Hiring, CSR 신호</p><a class="si-primary-link" href="'+esc(p.social)+'" target="_blank" rel="noopener noreferrer">↗ '+esc(p.name)+' LinkedIn '+(selected==="kohls"?"Official Profile":"Company Search")+'</a><p class="si-mini">현재 수집된 뉴스 중 소셜 원문 링크 '+posts.length+'건. 소셜 원문이 없다면 게시 내용은 추정하지 않습니다.</p></section>'+
      '<section class="si-card"><div class="si-card-header"><strong>02 / Strategic Readout</strong><span>Interpretation</span></div>'+
        '<p class="si-highlight">'+esc(textOf(b?.keyTakeaway)||"오늘 확인된 경쟁사 신호를 기반으로 Buyer 전략을 검토하세요.")+'</p>'+
        '<p class="si-mini">근거: Competitor Intelligence ('+esc(cd||"날짜 미확인")+'). 전략적 해석이며 공식 LinkedIn 발언으로 인용하지 않습니다.</p></section></div>'+
      '<div class="si-evidence-head"><h4>Evidence → Commercial Implication → Team Action</h4><span>최대 3건 · Source 링크 제공</span></div>'+
      (allSignals.length?'<div class="si-evidence">'+allSignals.map((x,i)=>{
        const refs=(x.sources||[]).slice(0,2);
        return '<article class="si-signal"><div class="si-number">'+String(i+1).padStart(2,"0")+'</div><div class="si-signal-body"><div class="si-tagline"><b>'+esc(x.name||"Competitor")+'</b><span>'+esc(x.signal||"Market signal")+'</span></div><h5>'+esc(textOf(x.move))+'</h5><p><b>Why it matters</b> · '+esc(textOf(x.whyItMatters))+'</p><div class="si-action"><b>Team 8 Action</b> · '+esc(textOf(x.action))+'</div><div class="si-links">'+refs.map(cardSource).join(" ")+(refs.length===0?'<span>원문 링크 미수집</span>':"")+'</div></div></article>';
      }).join("")+'</div>':'<div class="si-empty">현재 선택한 Buyer의 유효한 Competitor 신호가 없습니다. 근거 자료가 확보될 때 표시합니다.</div>')+
      '<div class="si-news-head"><strong>Related Buyer News</strong><span>소셜 게시물이 아닌 별도 뉴스 자료</span></div>'+
      (n.length?'<div class="si-news">'+n.slice(0,3).map(x=>'<div><b>'+esc(x.title_kr||x.title_en||"Buyer Update")+'</b><p>'+esc(x.body_kr||x.body_en||"")+'</p>'+cardSource({url:x.sourceUrl,source:x.source})+'</div>').join("")+'</div>':'<div class="si-empty">오늘 해당 Buyer의 선별 뉴스가 없습니다.</div>');
    root.querySelectorAll("[data-social-buyer]").forEach(el=>el.addEventListener("click",()=>{selected=el.dataset.socialBuyer;render()}));
  }
  async function load(){
    const [a,b]=await Promise.allSettled([
      fetch("/api/news",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()}),
      fetch("/api/competitors",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error(r.status);return r.json()})
    ]);
    if(a.status==="fulfilled"){news=Array.isArray(a.value.items)?a.value.items:[];nd=a.value.generatedDateKST||""}
    if(b.status==="fulfilled"){competitors=b.value;cd=b.value.generatedDateKST||""}
    render();
  }
  render();load();
})();