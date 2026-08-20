const MODEL=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite",BASE="https://generativelanguage.googleapis.com/v1beta/models",O=process.env.GITHUB_OWNER||"supermegayoon",R=process.env.GITHUB_REPO||"Newsletter-for-Div-8",B=process.env.GITHUB_BRANCH||"main",F="competitor-current.json";
const BUYERS=[
 {label:"Kohl's",c:[["Target",120,"MAIN"],["JCPenney",100,"MAIN"],["Macy's",98,"MAIN"],["Walmart",70,"SECONDARY"]]},
 {label:"A&F / Hollister",c:[["American Eagle",115,"MAIN"],["Aritzia",112,"MAIN"],["Urban Outfitters",110,"MAIN"],["Free People",108,"MAIN"],["Anthropologie",106,"MAIN"],["J.Crew",72,"SECONDARY"],["Zara",68,"SECONDARY"]]},
 {label:"Macy's",c:[["Nordstrom",110,"MAIN"],["JCPenney",102,"MAIN"],["Dillard's",100,"MAIN"]]},
 {label:"Ann Taylor",c:[["Banana Republic",110,"MAIN"],["J.Crew",105,"MAIN"],["White House Black Market",100,"MAIN"]]},
 {label:"Talbot's",c:[["J.Jill",110,"MAIN"],["Chico's",105,"MAIN"],["Lands' End",100,"MAIN"]]}
];
const kst=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
async function gh(u,o={}){if(!process.env.GITHUB_TOKEN)throw Error("GITHUB_TOKEN missing");let r=await fetch(u,{...o,headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",...(o.headers||{})}}),t=await r.text(),j={};try{j=t?JSON.parse(t):{}}catch{}if(!r.ok)throw Error(j.message||`GitHub ${r.status}`);return j}
async function read(){let j=await gh(`https://api.github.com/repos/${O}/${R}/contents/${F}?ref=${encodeURIComponent(B)}`);return{data:JSON.parse(Buffer.from(String(j.content||"").replace(/\n/g,""),"base64").toString()),sha:j.sha}}
async function save(x,sha){let b={message:`Competitor intelligence ${x.generatedDateKST}`,content:Buffer.from(JSON.stringify(x,null,2)+"\n").toString("base64"),branch:B};if(sha)b.sha=sha;return gh(`https://api.github.com/repos/${O}/${R}/contents/${F}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)})}
const clean=s=>String(s||"").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
const tag=(b,n)=>{let m=b.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${n}>`,"i"));return m?clean(m[1]):""};
const link=b=>{let m=b.match(/<link>([\s\S]*?)<\/link>/i);return m?clean(m[1]):""};
function source(b){let m=b.match(/<source(?:\s+url="([^"]*)")?>([\s\S]*?)<\/source>/i);return m?{url:m[1]||"",name:clean(m[2])}:{url:"",name:""}}
function tier(n="",u=""){let s=(n+" "+u).toLowerCase();if(["corporate.","investor","investors.","sec.gov","target.com","walmart.com","jcpenney.com","macysinc.com","ae.com","urbn.com","aritzia.com","jcrew.com","nordstrom.com","dillards.com","chicos.com","jjill.com","landsend.com"].some(x=>s.includes(x)))return["OFFICIAL",100];if(["reuters","bloomberg","cnbc","wall street journal","wsj","financial times","associated press","ap news"].some(x=>s.includes(x)))return["TIER 1",90];if(["retail dive","modern retail","glossy","wwd","sourcing journal","retail touchpoints","retail brew","business of fashion","fashion dive","fashionnetwork"].some(x=>s.includes(x)))return["INDUSTRY",75];return["GENERAL",55]}
async function rss(c){let[n,w,ct]=c,q=`${n} apparel fashion clothing product promotion retail store when:7d`,r=await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,{headers:{"User-Agent":"Mozilla/5.0"}});if(!r.ok)throw Error(`RSS ${r.status}`);let xml=await r.text(),seen=new Set();return[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(x=>x[1]).map(b=>{let s=source(b),d=tag(b,"pubDate"),h=(Date.now()-new Date(d).getTime())/36e5,[st,ss]=tier(s.name,s.url);return{name:n,competitorTier:ct,title:tag(b,"title"),description:tag(b,"description"),date:d,ageHours:h,source:s.name||"Google News",sourceTier:st,url:link(b),score:w+ss+(h<=24?30:h<=72?24:14)}}).filter(x=>x.title&&x.ageHours<=180).sort((a,b)=>b.score-a.score).filter(x=>{let k=x.title.toLowerCase().replace(/[^a-z0-9가-힣]+/g," ");if(seen.has(k))return false;seen.add(k);return true}).slice(0,10)}
function text(j){return(j?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||"").join("").replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/,"").trim()}
const dstr=d=>{let x=new Date(d);return Number.isFinite(x.getTime())?new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(x).replace(/-/g,"."):""};
function fallbackBuyer(label,raw){
 const top=[...raw].sort((a,b)=>b.score-a.score).slice(0,3);
 const comps=top.map(x=>({
   name:x.name,signal:"PRODUCT",
   move:{kr:x.title,en:x.title},
   whyItMatters:{kr:`${label}과 유사한 고객층을 두고 경쟁하는 ${x.name}의 최근 움직임으로, 상품·가격·promotion 방향을 비교할 필요가 있습니다.`,en:`Recent movement by ${x.name} is relevant to ${label}'s competitive set and should be compared across product, pricing and promotion.`},
   action:{kr:`${x.name}의 최근 움직임을 다음 buyer 제안 및 assortment review 시 참고하고 직접적인 대응 필요 여부를 확인합니다.`,en:`Use this ${x.name} signal in the next buyer proposal and assortment review, and assess whether a direct response is needed.`},
   sources:[{source:x.source,sourceTier:x.sourceTier,date:dstr(x.date),url:x.url}]
 }));
 return{buyer:label,competitionLevel:top.length>=3?"HIGH":top.length?"MEDIUM":"LOW",keyTakeaway:{kr:top.length?`${top.map(x=>x.name).join(", ")} 관련 최근 signal을 확인했습니다. 최신 source 기반으로 buyer별 대응 포인트를 점검할 필요가 있습니다.`:"최근 7일 내 유의미한 competitor signal이 제한적입니다.",en:top.length?`Recent signals were found for ${top.map(x=>x.name).join(", ")}. Review the implications by buyer using the cited sources.`:"Meaningful competitor signals were limited in the last 7 days."},competitors:comps}
}
async function collect(){
 const packs=[];
 for(const b of BUYERS){
   const s=await Promise.allSettled(b.c.map(rss));
   packs.push({buyer:b.label,evidence:s.flatMap(x=>x.status==="fulfilled"?x.value:[]).sort((a,b)=>b.score-a.score).slice(0,28)});
 }
 return packs;
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
 const r=await fetch(`${BASE}/${encodeURIComponent(MODEL)}:generateContent`,{method:"POST",headers:{"x-goog-api-key":process.env.GEMINI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:.2,maxOutputTokens:7600,responseMimeType:"application/json"}})});
 const j=await r.json();if(!r.ok)throw Error(j?.error?.message||`Gemini ${r.status}`);
 const parsed=JSON.parse(text(j));if(!Array.isArray(parsed.buyers)||parsed.buyers.length<5)throw Error("Gemini competitor JSON incomplete");
 return parsed.buyers;
}
async function build(){
 const packs=await collect();
 let buyers,mode="GEMINI";
 try{buyers=await synthAll(packs)}
 catch(e){buyers=packs.map(p=>fallbackBuyer(p.buyer,p.evidence));mode="RULE_FALLBACK"}
 return{ok:true,generatedDateKST:kst(),asOf:new Date().toISOString(),schedule:"Mon-Fri 08:00 KST",windowDays:7,analysisMode:mode,buyers}
}
module.exports=async(req,res)=>{
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
 res.setHeader("Cache-Control","no-store");
 let old=null,sha=null;try{let x=await read();old=x.data;sha=x.sha}catch{}
 const forced=String(req.query?.force||"")==="1";
 const authOk=!process.env.CRON_SECRET||req.headers.authorization===`Bearer ${process.env.CRON_SECRET}`;
 if(forced&&!authOk)return res.status(401).json({error:"Unauthorized"});
 if(!forced&&old?.generatedDateKST===kst())return res.status(200).json({...old,servedFrom:"saved"});
 if(!forced&&old)return res.status(200).json({...old,servedFrom:"saved",stale:old.generatedDateKST!==kst()});
 try{let x=await build();await save(x,sha);return res.status(200).json({...x,servedFrom:"fresh",bootstrapped:!old})}
 catch(e){return res.status(503).json({error:e.message})}
};