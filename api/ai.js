// api/ai.js
// Daily AI insight with quota-safe rule fallback.
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
async function competitorSnapshot(body){if(body?.competitors?.buyers?.length)return body.competitors;try{return(await readJson(COMP_FILE)).data}catch{return null}}
function firstNews(news,buyer){return news.find(x=>(x.brand||x.brandLabel)===buyer)||news[0]||null}
function compBuyer(c,b){return c?.buyers?.find(x=>x.buyer===b)||null}
function ruleInsight(body,competitors,reason){
 const news=Array.isArray(body.news)?body.news:[];
 const k=firstNews(news,"Kohl's"),a=firstNews(news,"A&F / Hollister"),m=firstNews(news,"Macy's");
 const kc=compBuyer(competitors,"Kohl's"),ac=compBuyer(competitors,"A&F / Hollister"),mc=compBuyer(competitors,"Macy's");
 const ksig=kc?.competitors?.[0],asig=ac?.competitors?.[0],msig=mc?.competitors?.[0];
 const headlineKr=(k?.title_kr||k?.title_en||ksig?.move?.kr||"주요 Buyer 및 Competitor 동향 점검");
 const headlineEn=(k?.title_en||k?.title_kr||ksig?.move?.en||"Buyer and Competitor Market Update");
 const insight={
  headline:{kr:headlineKr,en:headlineEn},
  summary:{kr:`오늘 Buyer News와 Competitor Intelligence를 기준으로 Kohl's, A&F/Hollister, Macy's의 주요 변화와 경쟁사 움직임을 함께 점검했습니다. Team 8은 상품, pricing, promotion 및 sourcing 관점에서 실제 제안으로 연결 가능한 signal을 우선 확인할 필요가 있습니다.`,en:`Today's brief combines buyer news and competitor intelligence across Kohl's, A&F/Hollister and Macy's. Team 8 should prioritize actionable signals in product, pricing, promotion and sourcing.`},
  tags:["#BuyerNews","#Competitor","#Team8","#DailyBrief"],
  buyerInsights:[
   {buyer:"Kohl's",kr:kc?.keyTakeaway?.kr||k?.body_kr||"Kohl's 관련 최신 News 및 competitor signal을 점검해야 합니다.",en:kc?.keyTakeaway?.en||k?.body_en||"Review the latest Kohl's news and competitor signals."},
   {buyer:"A&F / Hollister",kr:ac?.keyTakeaway?.kr||a?.body_kr||"A&F/Hollister 관련 최신 News 및 competitor signal을 점검해야 합니다.",en:ac?.keyTakeaway?.en||a?.body_en||"Review the latest A&F/Hollister news and competitor signals."},
   {buyer:"Macy's",kr:mc?.keyTakeaway?.kr||m?.body_kr||"Macy's 관련 최신 News 및 competitor signal을 점검해야 합니다.",en:mc?.keyTakeaway?.en||m?.body_en||"Review the latest Macy's news and competitor signals."}
  ],
  opportunities:[
   {kr:ksig?.action?.kr||"Kohl's 경쟁사 움직임을 다음 buyer 제안의 product/promotion 아이디어에 반영합니다.",en:ksig?.action?.en||"Use Kohl's competitor signals in the next product/promotion proposal."},
   {kr:asig?.action?.kr||"A&F/Hollister 경쟁사 상품 방향을 assortment 및 소재 제안과 비교합니다.",en:asig?.action?.en||"Compare A&F/Hollister competitor product direction with assortment and material proposals."},
   {kr:msig?.action?.kr||"Macy's 경쟁사 promotion 및 channel 전략을 Holiday 기획과 비교합니다.",en:msig?.action?.en||"Compare Macy's competitor promotion and channel strategy with Holiday planning."}
  ],
  risk:{level:"MEDIUM",kr:"일부 signal은 빠르게 변할 수 있으므로 source 원문 및 buyer 반응을 함께 확인해야 합니다.",en:"Some signals can change quickly, so validate source articles and buyer reactions before decisions."},
  actions:[
   {owner:"Team 8",kr:"오늘자 Buyer News와 competitor source 중 영업 제안으로 연결 가능한 1~2개 signal을 팀별로 선정합니다.",en:"Select 1-2 actionable buyer/competitor signals for each sales team."},
   {owner:"Team 8",kr:"가격, product, promotion 관점에서 buyer별 차별화 제안 가능성을 검토합니다.",en:"Review differentiated proposals by buyer across pricing, product and promotion."},
   {owner:"Team 8",kr:"중요 signal은 다음 개발 및 costing 논의에 반영할 수 있도록 source와 함께 공유합니다.",en:"Share important signals with sources for upcoming development and costing discussions."}
  ]
 };
 return post(insight);
}
async function generate(body){
 const competitors=await competitorSnapshot(body);
 if(!process.env.GEMINI_API_KEY) return {ok:true,asOf:new Date().toISOString(),generatedDateKST:kstDate(),schedule:"Mon-Fri 08:00 KST",refreshStatus:"RULE_FALLBACK",stale:false,provider:"Rule Fallback",model:null,usesCompetitorIntelligence:!!competitors?.buyers?.length,competitorDateKST:competitors?.generatedDateKST||null,insight:ruleInsight(body,competitors,"NO_KEY")};
 const prompt=`Create TODAY'S 8담당 DAILY MARKET BRIEF for a Korean apparel-vendor sales team.
KST ISSUE DATE: ${kstDate()}
Use MARKET + TODAY BUYER NEWS + COMPETITOR INTELLIGENCE.
Competitor is a first-class input. Compare buyer moves with competitor signals when useful. Never invent facts.
Korean grammar + natural English apparel/retail terms. Keep official names in English.
Return ONLY JSON:
{"headline":{"kr":"","en":""},"summary":{"kr":"","en":""},"tags":["#tag1","#tag2","#tag3","#tag4"],"buyerInsights":[{"buyer":"Kohl's","kr":"","en":""},{"buyer":"A&F / Hollister","kr":"","en":""},{"buyer":"Macy's","kr":"","en":""}],"opportunities":[{"kr":"","en":""},{"kr":"","en":""},{"kr":"","en":""}],"risk":{"level":"LOW|MEDIUM|HIGH","kr":"","en":""},"actions":[{"owner":"Team 8","kr":"","en":""},{"owner":"Team 8","kr":"","en":""},{"owner":"Team 8","kr":"","en":""}]}
MARKET=${JSON.stringify(body.market||{})}
NEWS=${JSON.stringify((body.news||[]).slice(0,20))}
COMPETITORS=${JSON.stringify(competitors||{})}`;
 try{
  const r=await fetch(`${BASE}/${encodeURIComponent(MODEL)}:generateContent`,{method:"POST",headers:{"x-goog-api-key":process.env.GEMINI_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:.6,maxOutputTokens:3600,responseMimeType:"application/json"}})});
  const j=await r.json();if(!r.ok)throw Error(j?.error?.message||`Gemini ${r.status}`);
  const insight=post(JSON.parse(extract(j)));
  return{ok:true,asOf:new Date().toISOString(),generatedDateKST:kstDate(),schedule:"Mon-Fri 08:00 KST",refreshStatus:"VERIFIED",stale:false,provider:"Google Gemini",model:MODEL,usesCompetitorIntelligence:!!competitors?.buyers?.length,competitorDateKST:competitors?.generatedDateKST||null,insight};
 }catch(e){
  return{ok:true,asOf:new Date().toISOString(),generatedDateKST:kstDate(),schedule:"Mon-Fri 08:00 KST",refreshStatus:"RULE_FALLBACK",stale:false,provider:"Rule Fallback",model:null,usesCompetitorIntelligence:!!competitors?.buyers?.length,competitorDateKST:competitors?.generatedDateKST||null,fallbackReason:e.message,insight:ruleInsight(body,competitors,e.message)};
 }
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