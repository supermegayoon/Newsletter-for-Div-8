const OWNER=process.env.GITHUB_OWNER||"supermegayoon";
const REPO=process.env.GITHUB_REPO||"Newsletter-for-Div-8";
const BRANCH=process.env.GITHUB_BRANCH||"main";
const RETENTION_DAYS=365;
const CURRENT_FILES=["market-current.json","news-current.json","ai-current.json","competitor-current.json","publication-current.json"];

function kstDate(d=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
function kstWeekday(d=new Date()){return new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Seoul",weekday:"short"}).format(d)}
function isWeekendKST(d=new Date()){const w=kstWeekday(d);return w==="Sat"||w==="Sun"}
function baseUrl(req){const p=req.headers["x-forwarded-proto"]||"https",h=req.headers["x-forwarded-host"]||req.headers.host;return`${p}://${h}`}

async function gh(url,o={}){
 if(!process.env.GITHUB_TOKEN)throw Error("GITHUB_TOKEN missing");
 const r=await fetch(url,{...o,headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",...(o.headers||{})}});
 const t=await r.text();let j={};try{j=t?JSON.parse(t):{}}catch{}if(!r.ok)throw Error(j?.message||`GitHub ${r.status}`);return j;
}
async function readFile(path){try{const j=await gh(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`);return{exists:true,data:JSON.parse(Buffer.from(String(j.content||"").replace(/\n/g,""),"base64").toString("utf8")),sha:j.sha}}catch{return{exists:false,data:null,sha:null}}}
async function writeFile(path,obj,msg){const old=await readFile(path),b={message:msg,content:Buffer.from(JSON.stringify(obj,null,2)+"\n","utf8").toString("base64"),branch:BRANCH};if(old.sha)b.sha=old.sha;return gh(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)})}
async function deleteFile(path,msg){const old=await readFile(path);if(!old.sha)return false;await gh(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:msg,sha:old.sha,branch:BRANCH})});return true}
async function snapshotCurrent(){const o={};for(const p of CURRENT_FILES)o[p]=await readFile(p);return o}
async function rollback(snap,today){const out={};for(const[p,s]of Object.entries(snap)){try{if(s.exists){await writeFile(p,s.data,`Rollback ${p} after failed publication ${today}`);out[p]="restored"}else{await deleteFile(p,`Rollback new ${p} after failed publication ${today}`);out[p]="removed"}}catch(e){out[p]=`rollback failed: ${e.message}`}}return out}
function componentDate(path,obj){if(!obj)return null;if(path==="market-current.json")return obj.snapshotDateKST||null;if(path==="publication-current.json")return obj.issueDateKST||null;return obj.generatedDateKST||null}
async function call(url,o={}){const r=await fetch(url,o),t=await r.text();let j={};try{j=t?JSON.parse(t):{}}catch{}if(!r.ok)throw Error(j?.error||j?.message||`${r.status} ${url}`);return j}
async function endpointExists(base,path,headers){try{const r=await fetch(`${base}${path}`,{headers});return r.status!==404}catch{return false}}
function cutoffDate(){return kstDate(new Date(Date.now()-RETENTION_DAYS*86400000))}
async function purgeExpired(index){const cutoff=cutoffDate(),dates=Array.isArray(index.dates)?index.dates:[],keep=dates.filter(d=>d>=cutoff),expired=dates.filter(d=>d<cutoff);for(const d of expired){for(const f of["market.json","news.json","ai.json","competitor.json","publication.json"]){try{await deleteFile(`archive/${d}/${f}`,`Purge expired archive ${d} ${f}`)}catch{}}}index.dates=keep;index.retentionDays=RETENTION_DAYS;index.cutoffDateKST=cutoff;index.updatedAt=new Date().toISOString();return{index,expired}}

async function bootstrapPreviousPublication(snapshot){
 const p=snapshot["publication-current.json"]?.data;if(p?.issueDateKST&&Number(p.issueNumber)>0)return p;
 const idx=(await readFile("archive/index.json")).data||{dates:[]};
 const dates=Array.isArray(idx.dates)?idx.dates:[];
 const currentDates=[componentDate("market-current.json",snapshot["market-current.json"]?.data),componentDate("news-current.json",snapshot["news-current.json"]?.data),componentDate("ai-current.json",snapshot["ai-current.json"]?.data)].filter(Boolean);
 const currentDate=currentDates.sort().reverse()[0]||null;
 const all=[...new Set([...dates,currentDate].filter(Boolean))].sort();
 return{ok:true,migrated:true,issueDateKST:currentDate,issueNumber:Math.max(1,all.length),generatedAt:snapshot["ai-current.json"]?.data?.asOf||snapshot["news-current.json"]?.data?.asOf||snapshot["market-current.json"]?.data?.updatedAt||null};
}

async function archivePrevious(snapshot,prev){
 if(!prev?.issueDateKST)return{archived:false,reason:"no previous publication"};
 const date=prev.issueDateKST,today=kstDate();if(date===today)return{archived:false,date,reason:"already today's publication"};
 const idx=await readFile("archive/index.json");let index=idx.data||{dates:[]};const dates=Array.isArray(index.dates)?index.dates:[];
 if(!dates.includes(date)){
  const map=[["market-current.json","market.json"],["news-current.json","news.json"],["ai-current.json","ai.json"],["competitor-current.json","competitor.json"]];
  for(const[cur,arc]of map){const s=snapshot[cur];if(!s?.data)continue;if(componentDate(cur,s.data)!==date)continue;await writeFile(`archive/${date}/${arc}`,s.data,`Archive ${arc} ${date}`)}
  await writeFile(`archive/${date}/publication.json`,prev,`Archive publication ${date}`);dates.unshift(date);index.dates=[...new Set(dates)].sort().reverse();
 }
 const p=await purgeExpired(index);await writeFile("archive/index.json",p.index,`Archive index ${today}`);
 return{archived:true,date,issueNumber:prev.issueNumber,retentionDays:RETENTION_DAYS,expiredRemoved:p.expired.length};
}

function validate(today,market,news,ai,comp,needComp){const c={market:market?.snapshotDateKST===today,news:news?.generatedDateKST===today,ai:ai?.generatedDateKST===today};if(needComp)c.competitors=comp?.generatedDateKST===today;const bad=Object.entries(c).filter(([,v])=>!v).map(([k])=>k);if(bad.length)throw Error(`Publication validation failed for: ${bad.join(", ")}`);return c}

module.exports=async(req,res)=>{
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
 if(process.env.CRON_SECRET&&req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return res.status(401).json({error:"Unauthorized"});
 const today=kstDate(),weekday=kstWeekday();
 if(isWeekendKST())return res.status(200).json({ok:true,skipped:true,reason:"WEEKEND_NO_PUBLICATION",issueDateKST:today,weekdayKST:weekday,message:"Saturday/Sunday KST: previous Friday edition remains live."});

 const base=baseUrl(req),auth=req.headers.authorization?{Authorization:req.headers.authorization}:{},out={ok:false,issueDateKST:today,weekdayKST:weekday,schedule:"Mon-Fri 08:00 KST",archiveRetentionDays:RETENTION_DAYS,startedAt:new Date().toISOString(),steps:{}};
 const snapshot=await snapshotCurrent();const prev=await bootstrapPreviousPublication(snapshot);
 if(prev?.issueDateKST===today&&snapshot["publication-current.json"]?.data?.status==="PUBLISHED"){out.ok=true;out.alreadyPublished=true;out.issueNumber=prev.issueNumber;out.finishedAt=new Date().toISOString();return res.status(200).json(out)}
 try{
  out.steps.archive=await archivePrevious(snapshot,prev);
  const market=await call(`${base}/api/market?force=1`,{headers:auth});out.steps.market={ok:true,date:market.snapshotDateKST};
  const news=await call(`${base}/api/news?force=1`,{headers:auth});out.steps.news={ok:true,date:news.generatedDateKST,count:news.items?.length||0};
  const ai=await call(`${base}/api/ai?force=1`,{method:"POST",headers:{...auth,"Content-Type":"application/json"},body:JSON.stringify({news:news.items||[],market:market.data||{}})});out.steps.ai={ok:true,date:ai.generatedDateKST};
  const needComp=await endpointExists(base,"/api/competitors",auth);let comp=null;
  if(needComp){comp=await call(`${base}/api/competitors?force=1`,{headers:auth});out.steps.competitors={ok:true,date:comp.generatedDateKST,buyers:comp.buyers?.length||0}}else out.steps.competitors={ok:true,skipped:true,reason:"competitor API not deployed"};
  out.steps.validation=validate(today,market,news,ai,comp,needComp);
  const issueNumber=Number(prev?.issueNumber||0)+1;
  const publication={ok:true,status:"PUBLISHED",issueDateKST:today,issueNumber,issueLabel:issueNumber===1?"창간호":`제${issueNumber}호`,schedule:"Mon-Fri 08:00 KST",publishedAt:new Date().toISOString(),previousIssueDateKST:prev?.issueDateKST||null,components:{marketDateKST:market.snapshotDateKST,marketDataDate:market.marketDataDate||null,newsDateKST:news.generatedDateKST,aiDateKST:ai.generatedDateKST,competitorDateKST:needComp?comp.generatedDateKST:null}};
  await writeFile("publication-current.json",publication,`Publish issue ${issueNumber} ${today} KST`);
  out.ok=true;out.status="PUBLISHED";out.issueNumber=issueNumber;out.issueLabel=publication.issueLabel;out.finishedAt=new Date().toISOString();return res.status(200).json(out);
 }catch(e){out.error=e.message;out.status="ROLLED_BACK";out.rollback=await rollback(snapshot,today);out.finishedAt=new Date().toISOString();return res.status(500).json(out)}
};
