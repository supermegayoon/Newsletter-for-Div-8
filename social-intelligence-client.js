// Social Intelligence displays only individually verified official LinkedIn posts.
(()=>{
  const profiles=[
    {id:"kohls",name:"Kohl's",url:"https://www.linkedin.com/company/kohls-department-stores/",official:true},
    {id:"af",name:"A&F / Hollister",url:"https://www.linkedin.com/search/results/companies/?keywords=Abercrombie%20%26%20Fitch",official:false},
    {id:"macys",name:"Macy's",url:"https://www.linkedin.com/search/results/companies/?keywords=Macy%27s",official:false},
    {id:"anntaylor",name:"Ann Taylor",url:"https://www.linkedin.com/search/results/companies/?keywords=Ann%20Taylor",official:false},
    {id:"talbots",name:"Talbot's",url:"https://www.linkedin.com/search/results/companies/?keywords=Talbots",official:false}
  ];
  const root=document.getElementById("social-intelligence-panel");
  if(!root)return;
  let selected="kohls",posts=[];
  const en=()=>document.body.classList.contains("en");
  const pick=x=>typeof x==="string"?x:(x?.[en()?"en":"kr"]||x?.kr||x?.en||"");
  const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const date=x=>/^\d{4}-\d{2}-\d{2}$/.test(x||"")&&!Number.isNaN(Date.parse(x));
  const canonical=x=>{try{const u=new URL(x);return u.origin+u.pathname.replace(/\/$/,"").toLowerCase()}catch{return""}};
  const postUrl=x=>{try{const u=new URL(x);return u.protocol==="https:"&&["linkedin.com","www.linkedin.com"].includes(u.hostname)&&(/^\/posts\/[^/]+$/.test(u.pathname.replace(/\/$/,""))||/^\/feed\/update\/urn:li:(activity|share):\d+$/.test(u.pathname.replace(/\/$/,"")))?u.href:""}catch{return""}};
  const valid=p=>{
    const profile=profiles.find(x=>x.id===p?.buyer);
    return !!(profile?.official&&p?.verified===true&&p?.platform==="LinkedIn"&&
      canonical(p.accountUrl)===canonical(profile.url)&&postUrl(p.sourceUrl)&&
      date(p.publishedAt)&&String(p.text||"").trim());
  };
  const label=(kr,enText)=>en()?enText:kr;
  function render(){
    const profile=profiles.find(x=>x.id===selected);
    const items=posts.filter(x=>x.buyer===selected).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,10);
    root.innerHTML=
      '<div class="si-heading"><div><div class="si-eyebrow">SOCIAL INTELLIGENCE</div><h3>'+label("공식 소셜 게시물","Official Social Posts")+'</h3><p>'+label("원문 링크와 게시 날짜가 확인된 공식 게시물만 표시합니다.","Only official posts with a verified source link and publication date appear here.")+'</p></div></div>'+
      '<div class="si-tabs" role="tablist" aria-label="Buyer selection">'+profiles.map(x=>'<button type="button" role="tab" aria-selected="'+(x.id===selected)+'" class="si-tab'+(x.id===selected?' active':'')+'" data-social-buyer="'+x.id+'">'+esc(x.name)+'</button>').join("")+'</div>'+
      '<div class="si-evidence-head"><h4>'+esc(profile.name)+' · '+label("최신 공식 게시물","Latest Official Posts")+'</h4><span>'+items.length+' '+label("건","posts")+'</span></div>'+
      (items.length?'<div class="si-evidence">'+items.map((p,i)=>
        '<article class="si-signal"><div class="si-number">'+String(i+1).padStart(2,"0")+'</div><div class="si-signal-body">'+
        '<div class="si-tagline"><b>'+esc(p.platform)+'</b><span>'+esc(p.publishedAt)+'</span></div>'+
        '<p class="si-post-text">'+esc(p.text)+'</p>'+
        (pick(p.analysis)?'<div class="si-action"><b>AI Social Analysis</b> · '+esc(pick(p.analysis))+'</div>':"")+
        (pick(p.signal)?'<p><b>Strategic Signal</b> · '+esc(pick(p.signal))+'</p>':"")+
        (pick(p.action)?'<p><b>Sae-A Opportunity / Action</b> · '+esc(pick(p.action))+'</p>':"")+
        '<div class="si-links"><a class="si-source-link" href="'+esc(postUrl(p.sourceUrl))+'" target="_blank" rel="noopener noreferrer">'+label("LinkedIn 원문 보기 ↗","Open original LinkedIn post ↗")+'</a></div>'+
        '</div></article>').join("")+'</div>':
        '<div class="si-empty"><strong>'+label("확인된 공식 게시물이 없습니다.","No verified official posts yet.")+'</strong><p>'+label("게시물 원문과 날짜를 확인하면 여기에 표시됩니다. 뉴스 기사나 경쟁사 분석을 대신 게시하지 않습니다.","Posts will appear after their original link and date are verified. News and competitor reports are not used as substitutes.")+'</p>'+'</div>')+
      '<p class="si-mini"><a href="'+esc(profile.url)+'" target="_blank" rel="noopener noreferrer">'+(profile.official?label("공식 LinkedIn 채널 ↗","Official LinkedIn channel ↗"):label("LinkedIn 기업 검색 ↗","Search LinkedIn companies ↗"))+'</a></p>';
    root.querySelectorAll("[data-social-buyer]").forEach(el=>el.addEventListener("click",()=>{selected=el.dataset.socialBuyer;render()}));
  }
  async function load(){
    try{
      const r=await fetch("/social-posts.json",{cache:"no-store"});
      if(!r.ok)throw Error(String(r.status));
      const data=await r.json();
      posts=Array.isArray(data.posts)?data.posts.filter(valid):[];
    }catch{posts=[]}
    render();
  }
  new MutationObserver(render).observe(document.body,{attributes:true,attributeFilter:["class"]});
  render();load();
})();