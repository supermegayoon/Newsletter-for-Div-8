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
async function rss(c){let[n,w,ct]=c,q=`${n} apparel fashion clothing product promotion retail store when:7d`,r=await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,{headers:{"User-Agent":"Mozilla/5.0"}});if(!r.ok)throw Error(`RSS ${r.status}`);let xml=await r.text(),seen=new Set();return[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(x=>x[1]).map(b=>{let s=source(b),d=tag(b,"pubDate"),h=(Date.now()-new Date(d).getTime())/36e5,[st,ss]=tier(s.name,s.url);return{name:n,competitorTier:ct,title:tag(b,"title"),description:tag(b,"description"),date:d,ageHours:h,source:s.name||"Google News",sourceTier:st,url:link(b),score:w+ss+(h<=24?30:h<=72?24:14)}}).filter(x=>x.title&&x.ageHours<=180).sort((a,b)=>b.score-a.score).filter(x=>{let k=x.title.toLowerCase().replace(/[^a-z0-9가-힣]+/g," ");if(seen.has(k))return false;seen.add(k);return true}).slice(0,12)}
function text(j){return(j?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||"").join("").replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/,"").trim()}
async function synth(b,raw){let p=`You are an apparel competitor-intelligence analyst for Team 8.
Buyer: ${b.label}
Use ONLY supplied evidence from the last 7 days.
Select the 3 most commercially meaningful competitor signals.
Kohl's: Target highest priority; JCPenney/Macy's main; Walmart secondary.
A&F/Hollister MAIN: American Eagle, Aritzia, Urban Outfitters, Free People, Anthropologie; J.Crew/Zara secondary.
Macy's: Nordstrom/JCPenney/Dillard's.
Ann Taylor: Banana Republic/J.Crew/White House Black Market.
Talbot's: J.Jill/Chico's/Lands' End.
Evidence quality: OFFICIAL > TIER 1 > INDUSTRY > GENERAL.
Never invent facts. Korean grammar + natural English apparel/retail terms.
Return JSON ONLY:
{"buyer":"${b.label}","competitionLevel":"LOW|MEDIUM|HIGH","keyTakeaway":{"kr":"","en":""},"competitors":[{"name":"","signal":"PRICE|PRODUCT|PROMOTION|CHANNEL|STORE|DIGITAL|SOURCING|FINANCIAL","move":{"kr":"","en":""},"whyItMatters":{"kr":"","en":""},"action":{"kr":"","en":""},"sources":[{"source":"","sourceTier":"OFFICIAL|TIER 1|INDUSTRY|GENERAL","date":"YYYY.MM.DD","url":"exact input url"}]}]}
EVIDENCE=${JSON.stringify(raw)}`;
 let r=await fetch(`${BASE}/${encodeURIComponent(MODEL)}:generateContent`,{method:"POST",headers:{"x-goog-api-key":process.env.GEMINI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:p}]}],generationConfig:{temperature:.2,maxOutputTokens:4200,responseMimeType:"application/json"}})}),j=await r.json();if(!r.ok)throw Error(j?.error?.message||`Gemini ${r.status}`);return JSON.parse(text(j))}
async function build(){let buyers=[];for(let b of BUYERS){let s=await Promise.allSettled(b.c.map(rss)),raw=s.flatMap(x=>x.status==="fulfilled"?x.value:[]);buyers.push(await synth(b,raw))}return{ok:true,generatedDateKST:kst(),asOf:new Date().toISOString(),schedule:"Mon-Fri 08:00 KST",windowDays:7,buyers}}
module.exports=async(req,res)=>{
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
 res.setHeader("Cache-Control","no-store");
 let old=null,sha=null;try{let x=await read();old=x.data;sha=x.sha}catch{}
 const forced=String(req.query?.force||"")==="1";
 const authOk=!process.env.CRON_SECRET||req.headers.authorization===`Bearer ${process.env.CRON_SECRET}`;
 if(forced&&!authOk)return res.status(401).json({error:"Unauthorized"});
 if(!forced&&old?.generatedDateKST===kst())return res.status(200).json({...old,servedFrom:"saved"});
 if(!forced&&old)return res.status(200).json({...old,servedFrom:"saved",stale:old.generatedDateKST!==kst()});
 // FIRST-RUN BOOTSTRAP: no snapshot exists, normal GET creates it once.
 try{let x=await build();await save(x,sha);return res.status(200).json({...x,servedFrom:"fresh",bootstrapped:!old})}
 catch(e){return res.status(503).json({error:e.message})}
};