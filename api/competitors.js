// File: /api/competitors.js
// Competitor Intelligence + SOCIAL PULSE
// No new Vercel API route is created.
// Social Pulse is folded into the existing /api/competitors function.
//
// Focus brands: Kohl's, A&F / Hollister, Macy's
// Priority source: public LinkedIn company page
// Fallback source: official/corporate news signals
// Shared cache: competitor-current.json
// Same KST-day visitors share the saved result.

const MODEL=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite",
BASE="https://generativelanguage.googleapis.com/v1beta/models",
O=process.env.GITHUB_OWNER||"supermegayoon",
R=process.env.GITHUB_REPO||"Newsletter-for-Div-8",
B=process.env.GITHUB_BRANCH||"main",
F="competitor-current.json";

const BUYERS=[
 {label:"Kohl's",c:[["Target",120,"MAIN"],["JCPenney",100,"MAIN"],["Macy's",98,"MAIN"],["Walmart",70,"SECONDARY"]]},
 {label:"A&F / Hollister",c:[["American Eagle",115,"MAIN"],["Aritzia",112,"MAIN"],["Urban Outfitters",110,"MAIN"],["Free People",108,"MAIN"],["Anthropologie",106,"MAIN"],["J.Crew",72,"SECONDARY"],["Zara",68,"SECONDARY"]]},
 {label:"Macy's",c:[["Nordstrom",110,"MAIN"],["JCPenney",102,"MAIN"],["Dillard's",100,"MAIN"]]},
 {label:"Ann Taylor",c:[["Banana Republic",110,"MAIN"],["J.Crew",105,"MAIN"],["White House Black Market",100,"MAIN"]]},
 {label:"Talbot's",c:[["J.Jill",110,"MAIN"],["Chico's",105,"MAIN"],["Lands' End",100,"MAIN"]]}
];

const SOCIAL_BRANDS=[
 {
  key:"kohls",label:"Kohl's",
  linkedin:"https://www.linkedin.com/company/kohls-department-stores",
  officialQuery:'Kohl\'s corporate apparel campaign product private brand store earnings'
 },
 {
  key:"af",label:"A&F / Hollister",
  linkedin:"https://www.linkedin.com/company/abercrombie-%26-fitch/",
  officialQuery:'Abercrombie Fitch Hollister corporate apparel collaboration product campaign earnings'
 },
 {
  key:"macys",label:"Macy's",
  linkedin:"https://www.linkedin.com/company/macy/",
  officialQuery:'Macy\'s Inc corporate apparel fashion campaign product earnings stores'
 }
];

const kst=()=>new Intl.DateTimeFormat("en-CA",{
 timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"
}).format(new Date());

async function gh(u,o={}){
 if(!process.env.GITHUB_TOKEN)throw Error("GITHUB_TOKEN missing");
 let r=await fetch(u,{
  ...o,
  headers:{
   Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,
   Accept:"application/vnd.github+json",
   "X-GitHub-Api-Version":"2022-11-28",
   ...(o.headers||{})
  }
 });
 let t=await r.text(),j={};
 try{j=t?JSON.parse(t):{}}catch{}
 if(!r.ok)throw Error(j.message||`GitHub ${r.status}`);
 return j
}

async function read(){
 let j=await gh(`https://api.github.com/repos/${O}/${R}/contents/${F}?ref=${encodeURIComponent(B)}`);
 return{
  data:JSON.parse(Buffer.from(String(j.content||"").replace(/\n/g,""),"base64").toString()),
  sha:j.sha
 }
}

async function save(x,sha){
 let b={
  message:`Competitor + Social Pulse ${x.generatedDateKST}`,
  content:Buffer.from(JSON.stringify(x,null,2)+"\n").toString("base64"),
  branch:B
 };
 if(sha)b.sha=sha;
 return gh(`https://api.github.com/repos/${O}/${R}/contents/${F}`,{
  method:"PUT",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify(b)
 })
}

const clean=s=>String(s||"")
 .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1")
 .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'")
 .replace(/&lt;/g,"<").replace(/&gt;/g,">")
 .replace(/<script[\s\S]*?<\/script>/gi," ")
 .replace(/<style[\s\S]*?<\/style>/gi," ")
 .replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();

const tag=(b,n)=>{
 let m=b.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${n}>`,"i"));
 return m?clean(m[1]):""
};

const link=b=>{
 let m=b.match(/<link>([\s\S]*?)<\/link>/i);
 return m?clean(m[1]):""
};

function source(b){
 let m=b.match(/<source(?:\s+url="([^"]*)")?>([\s\S]*?)<\/source>/i);
 return m?{url:m[1]||"",name:clean(m[2])}:{url:"",name:""}
}

function tier(n="",u=""){
 let s=(n+" "+u).toLowerCase();
 if(["corporate.","investor","investors.","sec.gov","target.com","walmart.com","jcpenney.com","macysinc.com","ae.com","urbn.com","aritzia.com","jcrew.com","nordstrom.com","dillards.com","chicos.com","jjill.com","landsend.com"].some(x=>s.includes(x)))return["OFFICIAL",100];
 if(["reuters","bloomberg","cnbc","wall street journal","wsj","financial times","associated press","ap news"].some(x=>s.includes(x)))return["TIER 1",90];
 if(["retail dive","modern retail","glossy","wwd","sourcing journal","retail touchpoints","retail brew","business of fashion","fashion dive","fashionnetwork"].some(x=>s.includes(x)))return["INDUSTRY",75];
 return["GENERAL",55]
}

async function rss(c){
 let[n,w,ct]=c,
 q=`${n} apparel fashion clothing product promotion retail store when:7d`,
 r=await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,{
  headers:{"User-Agent":"Mozilla/5.0"}
 });
 if(!r.ok)throw Error(`RSS ${r.status}`);
 let xml=await r.text(),seen=new Set();
 return[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
  .map(x=>x[1])
  .map(b=>{
   let s=source(b),d=tag(b,"pubDate"),
   h=(Date.now()-new Date(d).getTime())/36e5,
   [st,ss]=tier(s.name,s.url);
   return{
    name:n,competitorTier:ct,title:tag(b,"title"),description:tag(b,"description"),
    date:d,ageHours:h,source:s.name||"Google News",sourceTier:st,url:link(b),
    score:w+ss+(h<=24?30:h<=72?24:14)
   }
  })
  .filter(x=>x.title&&x.ageHours<=180)
  .sort((a,b)=>b.score-a.score)
  .filter(x=>{
   let k=x.title.toLowerCase().replace(/[^a-z0-9가-힣]+/g," ");
   if(seen.has(k))return false;
   seen.add(k);return true
  }).slice(0,10)
}

function text(j){
 return(j?.candidates?.[0]?.content?.parts||[])
  .map(p=>p.text||"").join("")
  .replace(/^```json\s*/i,"").replace(/^```\s*/i,"")
  .replace(/\s*```$/,"").trim()
}

const dstr=d=>{
 let x=new Date(d);
 return Number.isFinite(x.getTime())
  ?new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(x).replace(/-/g,".")
  :""
};

function fallbackBuyer(label,raw){
 const top=[...raw].sort((a,b)=>b.score-a.score).slice(0,3);
 const comps=top.map(x=>({
  name:x.name,signal:"PRODUCT",
  move:{kr:x.title,en:x.title},
  whyItMatters:{
   kr:`${label}과 유사한 고객층을 두고 경쟁하는 ${x.name}의 최근 움직임으로, 상품·가격·promotion 방향을 비교할 필요가 있습니다.`,
   en:`Recent movement by ${x.name} is relevant to ${label}'s competitive set and should be compared across product, pricing and promotion.`
  },
  action:{
   kr:`${x.name}의 최근 움직임을 다음 buyer 제안 및 assortment review 시 참고하고 직접적인 대응 필요 여부를 확인합니다.`,
   en:`Use this ${x.name} signal in the next buyer proposal and assortment review, and assess whether a direct response is needed.`
  },
  sources:[{source:x.source,sourceTier:x.sourceTier,date:dstr(x.date),url:x.url}]
 }));
 return{
  buyer:label,
  competitionLevel:top.length>=3?"HIGH":top.length?"MEDIUM":"LOW",
  keyTakeaway:{
   kr:top.length?`${top.map(x=>x.name).join(", ")} 관련 최근 signal을 확인했습니다. 최신 source 기반으로 buyer별 대응 포인트를 점검할 필요가 있습니다.`:"최근 7일 내 유의미한 competitor signal이 제한적입니다.",
   en:top.length?`Recent signals were found for ${top.map(x=>x.name).join(", ")}. Review the implications by buyer using the cited sources.`:"Meaningful competitor signals were limited in the last 7 days."
  },
  competitors:comps
 }
}

async function collect(){
 const packs=[];
 for(const b of BUYERS){
  const s=await Promise.allSettled(b.c.map(rss));
  packs.push({
   buyer:b.label,
   evidence:s.flatMap(x=>x.status==="fulfilled"?x.value:[])
    .sort((a,b)=>b.score-a.score).slice(0,28)
  });
 }
 return packs
}

async function synthAll(packs){
 if(!process.env.GEMINI_API_KEY)throw Error("GEMINI_API_KEY missing");
 const prompt=`You are an apparel competitor-intelligence analyst for Team 8.
Analyze ALL five buyers in ONE response using ONLY supplied evidence from the last 7 days.
Select the 3 most commercially meaningful competitor signals PER BUYER.
Priority:
Kohl's: Target highest; JCPenney/Macy's main; Walmart secondary.
A&F/Hollister MAIN: American Eagle, Aritzia, Urban Outfitters, Free People, Anthropologie; J.Crew/Zara secondary.
Macy's: Nordstrom/JCPenney/Dillard's.
Ann Taylor: Banana Republic/J.Crew/White House Black Market.
Talbot's: J.Jill/Chico's/Lands' End.
Evidence quality: OFFICIAL > TIER 1 > INDUSTRY > GENERAL.
Never invent facts. Korean grammar + natural English apparel/retail terms.
Return JSON ONLY:
{"buyers":[{"buyer":"","competitionLevel":"LOW|MEDIUM|HIGH","keyTakeaway":{"kr":"","en":""},"competitors":[{"name":"","signal":"PRICE|PRODUCT|PROMOTION|CHANNEL|STORE|DIGITAL|SOURCING|FINANCIAL","move":{"kr":"","en":""},"whyItMatters":{"kr":"","en":""},"action":{"kr":"","en":""},"sources":[{"source":"","sourceTier":"OFFICIAL|TIER 1|INDUSTRY|GENERAL","date":"YYYY.MM.DD","url":"exact input url"}]}]}]}
EVIDENCE=${JSON.stringify(packs)}`;
 const r=await fetch(`${BASE}/${encodeURIComponent(MODEL)}:generateContent`,{
  method:"POST",
  headers:{"x-goog-api-key":process.env.GEMINI_API_KEY,"Content-Type":"application/json"},
  body:JSON.stringify({
   contents:[{parts:[{text:prompt}]}],
   generationConfig:{temperature:.2,maxOutputTokens:7600,responseMimeType:"application/json"}
  })
 });
 const j=await r.json();
 if(!r.ok)throw Error(j?.error?.message||`Gemini ${r.status}`);
 const parsed=JSON.parse(text(j));
 if(!Array.isArray(parsed.buyers)||parsed.buyers.length<5)throw Error("Gemini competitor JSON incomplete");
 return parsed.buyers
}

// ---------------- SOCIAL PULSE ----------------

function htmlVisibleText(html=""){
 return clean(
  html
   .replace(/<svg[\s\S]*?<\/svg>/gi," ")
   .replace(/<noscript[\s\S]*?<\/noscript>/gi," ")
 )
}

async function fetchLinkedInPublic(b){
 const r=await fetch(b.linkedin,{
  headers:{
   "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
   "Accept-Language":"en-US,en;q=0.9"
  },
  redirect:"follow"
 });
 if(!r.ok)throw Error(`LinkedIn ${r.status}`);
 const html=await r.text();
 const visible=htmlVisibleText(html);
 if(!visible||visible.length<500)throw Error("LinkedIn public text unavailable");

 // LinkedIn public pages normally expose an Updates section.
 // Take only a bounded section to control Gemini tokens.
 let idx=visible.toLowerCase().indexOf("updates");
 let excerpt=idx>=0?visible.slice(idx,idx+16000):visible.slice(0,16000);

 return{
  brand:b.label,
  sourceType:"LINKEDIN",
  profileUrl:b.linkedin,
  raw:excerpt
 }
}

async function officialSocialFallback(b){
 const q=`${b.officialQuery} when:14d`;
 const r=await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,{
  headers:{"User-Agent":"Mozilla/5.0"}
 });
 if(!r.ok)throw Error(`Official fallback RSS ${r.status}`);
 const xml=await r.text();
 const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>m[1]).map(x=>({
  title:tag(x,"title"),
  date:tag(x,"pubDate"),
  source:source(x).name||"Google News",
  url:link(x),
  description:tag(x,"description")
 })).filter(x=>x.title).slice(0,8);

 return{
  brand:b.label,
  sourceType:"OFFICIAL_FALLBACK",
  profileUrl:b.linkedin,
  raw:JSON.stringify(items)
 }
}

async function collectSocialEvidence(){
 const out=[];
 for(const b of SOCIAL_BRANDS){
  try{
   out.push(await fetchLinkedInPublic(b))
  }catch(e){
   try{
    out.push(await officialSocialFallback(b))
   }catch(e2){
    out.push({brand:b.label,sourceType:"UNAVAILABLE",profileUrl:b.linkedin,raw:""})
   }
  }
 }
 return out
}

function socialFallbackSeed(){
 return[
  {
   brand:"Kohl's",platform:"LinkedIn",signal:"CAMPAIGN",
   date:"2026.09.07",
   headline:{kr:"Kohl's So-Back Studio로 BTS campaign 경험 확대",en:"Kohl's Extends BTS Campaign Through the So-Back Studio"},
   summary:{kr:"Kohl's는 New York에서 'We Are So Back (To School)' campaign과 연결된 interactive pop-up을 소개하며 첫 등교일의 self-expression과 confidence를 강조했습니다.",en:"Kohl's highlighted an interactive New York pop-up tied to its 'We Are So Back (To School)' campaign, emphasizing self-expression and confidence around the first day of school."},
   whyItMatters:{kr:"단순 price promotion보다 experience와 self-expression을 결합한 BTS storytelling을 강화하는 흐름입니다.",en:"The signal points to BTS storytelling that blends experience and self-expression rather than relying only on price promotion."},
   action:{kr:"Kids/Tek Gear 제안 시 product story와 styling/graphic concept을 campaign theme에 연결할 수 있는 option을 준비.",en:"For Kids/Tek Gear proposals, prepare product stories and styling/graphic concepts that can connect to campaign themes."},
   sourceUrl:"https://www.linkedin.com/company/kohls-department-stores"
  },
  {
   brand:"A&F / Hollister",platform:"LinkedIn",signal:"COLLAB",
   date:"2026.09.13",
   headline:{kr:"A&F, NFL Fashion Partnership를 multi-category로 확대",en:"A&F Expands Its NFL Fashion Partnership Across Categories"},
   summary:{kr:"A&F는 NFL Official Fashion Partner 2년차를 강조하며 men's, women's뿐 아니라 kids, baby, toddler까지 assortment를 확대하고 Fanatics·NFLShop·stadium store distribution을 넓혔습니다.",en:"A&F highlighted year two as an Official Fashion Partner of the NFL, expanding assortments across men's, women's, kids, baby and toddler while broadening distribution through Fanatics, NFLShop and stadium stores."},
   whyItMatters:{kr:"Sports × Fashion이 seasonal capsule이 아니라 category와 channel을 넓히는 성장 platform으로 발전하고 있습니다.",en:"Sports × Fashion is developing from a seasonal capsule into a broader category and channel growth platform."},
   action:{kr:"Kids/Baby까지 확장 가능한 licensed graphic, fleece, jersey-inspired program과 빠른 drop 대응 capability를 제안 포인트로 준비.",en:"Prepare licensed graphic, fleece and jersey-inspired programs that can extend into Kids/Baby, with fast drop-response capability."},
   sourceUrl:"https://www.linkedin.com/company/abercrombie-%26-fitch/"
  },
  {
   brand:"Macy's",platform:"LinkedIn",signal:"FINANCIAL",
   date:"2026.09.13",
   headline:{kr:"Macy's, Q2 customer response 개선과 full-year outlook 상향 강조",en:"Macy's Highlights Better Q2 Customer Response and Raised Full-Year Outlook"},
   summary:{kr:"Macy's는 newness, compelling assortment, Reimagine stores와 digital investment가 Q2 성과를 견인했고 full-year outlook을 상향했다고 공유했습니다.",en:"Macy's said newness, compelling assortments, Reimagine stores and digital investments helped drive Q2 performance and supported a higher full-year outlook."},
   whyItMatters:{kr:"Buyer가 단순 inventory 축소보다 newness와 differentiated assortment에 다시 투자할 여지가 커지는 signal입니다.",en:"The signal suggests more room to invest in newness and differentiated assortments rather than focusing only on inventory reduction."},
   action:{kr:"Macy's 제안은 opening price만 강조하기보다 differentiated fabric/detail과 빠른 newness 제안을 함께 준비.",en:"For Macy's, pair opening-price options with differentiated fabric/detail ideas and faster newness proposals."},
   sourceUrl:"https://www.linkedin.com/company/macy/"
  }
 ]
}

async function synthSocial(evidence){
 if(!process.env.GEMINI_API_KEY)throw Error("GEMINI_API_KEY missing");

 const prompt=`You are creating "SOCIAL PULSE" for a Korean apparel vendor sales team.

FOCUS ONLY:
- Kohl's
- A&F / Hollister
- Macy's

INPUT may contain public LinkedIn company-page text. If LinkedIn was unavailable, it may contain official/corporate recent-news fallback evidence.

GOAL:
Select up to TWO meaningful recent signals per brand, but only signals relevant to apparel sales/merchandising/sourcing.

HIGH VALUE:
PRODUCT, COLLAB, CAMPAIGN, STRATEGY, FINANCIAL, STORE, DIGITAL, LEADERSHIP if it changes commercial direction.

LOW VALUE / OMIT:
generic hiring, employee anniversaries, charity, generic culture posts, congratulations without a commercial implication.

For each selected signal:
- summarize what the brand itself is emphasizing
- explain Why It Matters for an apparel vendor
- give one specific TEAM 8 ACTION
- never invent facts or dates
- if evidence is weak, return fewer items
- Korean should sound like a Korean apparel sales manager, using natural English business terms where appropriate.

Return JSON ONLY:
{"items":[
 {
  "brand":"Kohl's|A&F / Hollister|Macy's",
  "platform":"LinkedIn|Official",
  "signal":"PRODUCT|COLLAB|CAMPAIGN|STRATEGY|FINANCIAL|STORE|DIGITAL|LEADERSHIP",
  "date":"YYYY.MM.DD or RECENT",
  "headline":{"kr":"","en":""},
  "summary":{"kr":"","en":""},
  "whyItMatters":{"kr":"","en":""},
  "action":{"kr":"","en":""},
  "sourceUrl":"use the supplied LinkedIn profile URL or exact official URL when available"
 }
]}

EVIDENCE=${JSON.stringify(evidence)}`;

 const r=await fetch(`${BASE}/${encodeURIComponent(MODEL)}:generateContent`,{
  method:"POST",
  headers:{"x-goog-api-key":process.env.GEMINI_API_KEY,"Content-Type":"application/json"},
  body:JSON.stringify({
   contents:[{parts:[{text:prompt}]}],
   generationConfig:{temperature:.15,maxOutputTokens:4200,responseMimeType:"application/json"}
  })
 });
 const j=await r.json();
 if(!r.ok)throw Error(j?.error?.message||`Gemini ${r.status}`);
 const parsed=JSON.parse(text(j));
 if(!Array.isArray(parsed.items))throw Error("Social Pulse JSON incomplete");

 // Keep max 2 per brand / max 6 overall
 const counts={},items=[];
 for(const x of parsed.items){
  if(!SOCIAL_BRANDS.some(b=>b.label===x.brand))continue;
  counts[x.brand]=counts[x.brand]||0;
  if(counts[x.brand]>=2)continue;
  counts[x.brand]++;
  items.push(x);
 }
 if(!items.length)throw Error("No useful Social Pulse signals");
 return items.slice(0,6)
}

async function buildSocial(){
 const evidence=await collectSocialEvidence();
 try{
  const items=await synthSocial(evidence);
  return{
   ok:true,
   generatedDateKST:kst(),
   windowDays:14,
   analysisMode:"GEMINI",
   brands:["Kohl's","A&F / Hollister","Macy's"],
   items
  }
 }catch(e){
  return{
   ok:true,
   generatedDateKST:kst(),
   windowDays:14,
   analysisMode:"SEED_FALLBACK",
   brands:["Kohl's","A&F / Hollister","Macy's"],
   warning:e.message,
   items:socialFallbackSeed()
  }
 }
}

async function build(){
 const [packs,social]=await Promise.all([collect(),buildSocial()]);
 let buyers,mode="GEMINI";
 try{buyers=await synthAll(packs)}
 catch(e){buyers=packs.map(p=>fallbackBuyer(p.buyer,p.evidence));mode="RULE_FALLBACK"}

 return{
  ok:true,
  generatedDateKST:kst(),
  asOf:new Date().toISOString(),
  schedule:"Mon-Fri 08:00 KST",
  windowDays:7,
  analysisMode:mode,
  buyers,
  socialPulse:social
 }
}

module.exports=async(req,res)=>{
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
 res.setHeader("Cache-Control","no-store");

 let old=null,sha=null;
 try{let x=await read();old=x.data;sha=x.sha}catch{}

 const forced=String(req.query?.force||"")==="1";
 const authOk=!process.env.CRON_SECRET||req.headers.authorization===`Bearer ${process.env.CRON_SECRET}`;

 if(forced&&!authOk)return res.status(401).json({error:"Unauthorized"});

 // IMPORTANT:
 // Old snapshots created before Social Pulse existed are rebuilt once,
 // even if generatedDateKST is already today.
 const hasSocial=Array.isArray(old?.socialPulse?.items)&&old.socialPulse.items.length>0;

 if(!forced&&old?.generatedDateKST===kst()&&hasSocial)
  return res.status(200).json({...old,servedFrom:"saved"});

 if(!forced&&old&&hasSocial)
  return res.status(200).json({...old,servedFrom:"saved",stale:old.generatedDateKST!==kst()});

 try{
  let x=await build();
  await save(x,sha);
  return res.status(200).json({...x,servedFrom:"fresh",bootstrapped:!old||!hasSocial})
 }catch(e){
  // Never break the whole dashboard if Social/Competitor refresh fails.
  if(old)return res.status(200).json({...old,servedFrom:"stale",stale:true,refreshError:e.message});
  return res.status(503).json({error:e.message})
 }
};
