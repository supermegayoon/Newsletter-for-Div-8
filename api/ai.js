// api/ai.js
// Daily Gemini insight: Market + Buyer News + Competitor Intelligence.

const MODEL=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";
const BASE="https://generativelanguage.googleapis.com/v1beta/models";
const FILE="ai-current.json",COMP_FILE="competitor-current.json";
const OWNER=process.env.GITHUB_OWNER||"supermegayoon",REPO=process.env.GITHUB_REPO||"Newsletter-for-Div-8",BRANCH=process.env.GITHUB_BRANCH||"main";

function kstDate(d=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
function savedDate(x){return x?.generatedDateKST||null}
function force(req){if(String(req.query?.force||"")!=="1")return false;if(!process.env.CRON_SECRET)return true;return req.headers.authorization===`Bearer ${process.env.CRON_SECRET}`}
async function gh(url,o={}){if(!process.env.GITHUB_TOKEN)throw Error("GITHUB_TOKEN missing");const r=await fetch(url,{...o,headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",...(o.headers||{})}}),t=await r.text();let j={};try{j=t?JSON.parse(t):{}}catch{}if(!r.ok)throw Error(j?.message||`GitHub ${r.status}`);return j}
async function readJson(path){const j=await gh(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`);return{data:JSON.parse(Buffer.from(String(j.content||"").replace(/\n/g,""),"base64").toString()),sha:j.sha}}
async function save(o,sha){const b={message:`Daily AI ${o.generatedDateKST}`,content:Buffer.from(JSON.stringify(o,null,2)+"\n").toString("base64"),branch:BRANCH};if(sha)b.sha=sha;return gh(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)})}
function extract(j){return(j?.candidates?.[0]?.content?.parts||[]).map(p=>p?.text||"").join("\n").replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/,"").trim()}

const REP=[[/머신다이즈|머천다이즈/g,"merchandise"],[/홀리데이/g,"Holiday"],[/익스클루시브/g,"exclusive"],[/파트너십/g,"Partnership"],[/오프라인/g,"offline"],[/온라인/g,"online"],[/프로모션/g,"promotion"],[/콜라보레이션/g,"Collaboration"],[/리테일/g,"retail"],[/이커머스|이-커머스/g,"E-commerce"],[/마켓플레이스/g,"Marketplace"],[/액티브웨어/g,"activewear"],[/프라이빗 브랜드/g,"private brand"],[/홀세일/g,"wholesale"],[/셀스루|셀-스루/g,"sell-through"],[/리오더/g,"reorder"],[/리드타임/g,"lead time"],[/소싱/g,"sourcing"],[/인벤토리/g,"inventory"],[/마진/g,"margin"],[/프라이싱/g,"pricing"],[/카테고리/g,"category"],[/스토어/g,"store"],[/트래픽/g,"traffic"],[/가이던스/g,"guidance"],[/아웃룩/g,"outlook"],[/퍼레이드/g,"Parade"]];
function post(v){if(typeof v==="string"){for(const[a,b]of REP)v=v.replace(a,b);return v}if(Array.isArray(v))return v.map(post);if(v&&typeof v==="object"){const o={};for(const[k,x]of Object.entries(v))o[k]=post(x);return o}return v}

async function competitorSnapshot(body){
  if(body?.competitors?.buyers?.length)return body.competitors;
  try{return(await readJson(COMP_FILE)).data}catch{return null}
}

async function generate(body){
 if(!process.env.GEMINI_API_KEY)throw Error("GEMINI_API_KEY missing");
 const competitors=await competitorSnapshot(body);

 const prompt=`Create TODAY'S 8담당 DAILY MARKET BRIEF for a Korean apparel-vendor sales team.
KST ISSUE DATE: ${kstDate()}

INPUTS:
1. MARKET SNAPSHOT
2. TODAY BUYER NEWS
3. COMPETITOR INTELLIGENCE

IMPORTANT ANALYSIS RULE:
- Competitor Intelligence is a first-class input, not an appendix.
- Buyer Insight should compare the buyer's own moves with competitor signals when useful.
- Opportunities and Team 8 Actions should identify where competitor moves create a sales/product/sourcing opportunity.
- Do not force competitor commentary when the evidence is weak.
- For Kohl's, pay particular attention to Target.
- For A&F/Hollister, pay attention to American Eagle, Aritzia, Urban Outfitters, Free People and Anthropologie.
- Distinguish FACT from inference.
- Never invent information beyond the supplied inputs.
- Avoid simply repeating competitor cards; synthesize what it means for our buyer/business.

WRITING STYLE:
Korean grammar with natural English apparel/retail terms.
Keep official Brand/Product/Campaign/Collection names in English.
Use merchandise, Holiday, exclusive, Collaboration, retail, promotion, inventory,
traffic, sourcing, margin, pricing, activewear, denim, sell-through, reorder, lead time naturally.

Return ONLY JSON:
{
 "headline":{"kr":"","en":""},
 "summary":{"kr":"2-3 sentences synthesizing buyer + competitor + market signals","en":"2-3 sentences"},
 "tags":["#tag1","#tag2","#tag3","#tag4"],
 "buyerInsights":[
  {"buyer":"Kohl's","kr":"","en":""},
  {"buyer":"A&F / Hollister","kr":"","en":""},
  {"buyer":"Macy's","kr":"","en":""}
 ],
 "opportunities":[{"kr":"","en":""},{"kr":"","en":""},{"kr":"","en":""}],
 "risk":{"level":"LOW|MEDIUM|HIGH","kr":"","en":""},
 "actions":[
  {"owner":"Team 8","kr":"","en":""},
  {"owner":"Team 8","kr":"","en":""},
  {"owner":"Team 8","kr":"","en":""}
 ]
}

MARKET:
${JSON.stringify(body.market||{})}

TODAY BUYER NEWS:
${JSON.stringify((body.news||[]).slice(0,20))}

COMPETITOR INTELLIGENCE:
${JSON.stringify(competitors||{})}`;

 const r=await fetch(`${BASE}/${encodeURIComponent(MODEL)}:generateContent`,{method:"POST",headers:{"x-goog-api-key":process.env.GEMINI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:.6,maxOutputTokens:3600,responseMimeType:"application/json"}})});
 const j=await r.json();if(!r.ok)throw Error(j?.error?.message||`Gemini ${r.status}`);
 let insight;try{insight=post(JSON.parse(extract(j)))}catch{throw Error("Gemini JSON parsing failed")}
 return{ok:true,asOf:new Date().toISOString(),generatedDateKST:kstDate(),schedule:"Mon-Fri 08:00 KST",refreshStatus:"VERIFIED",stale:false,provider:"Google Gemini",model:MODEL,usesCompetitorIntelligence:!!competitors?.buyers?.length,competitorDateKST:competitors?.generatedDateKST||null,insight};
}

module.exports=async(req,res)=>{
 let saved=null,sha=null;try{const x=await readJson(FILE);saved=x.data;sha=x.sha}catch{}
 if(req.method==="GET")return saved?res.status(200).json({...saved,servedFrom:"saved"}):res.status(503).json({error:"No saved AI"});
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 const f=force(req);if(String(req.query?.force||"")==="1"&&!f)return res.status(401).json({error:"Unauthorized"});
 if(!f&&savedDate(saved)===kstDate())return res.status(200).json({...saved,servedFrom:"saved"});
 try{const fresh=await generate(req.body||{});try{await save(fresh,sha)}catch(e){fresh.saveWarning=e.message}return res.status(200).json({...fresh,servedFrom:"fresh"})}
 catch(e){return saved?res.status(200).json({...saved,stale:true,refreshStatus:"STALE_FALLBACK",refreshError:e.message}):res.status(503).json({error:e.message})}
};