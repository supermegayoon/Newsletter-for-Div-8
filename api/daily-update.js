// File: /api/daily-update.js
// 23:00 UTC = 08:00 KST.
// BEFORE creating today's brief, archive the previous current files by their KST issue date.
// Then refresh Market -> News -> AI.

const OWNER=process.env.GITHUB_OWNER||"supermegayoon";
const REPO=process.env.GITHUB_REPO||"Newsletter-for-Div-8";
const BRANCH=process.env.GITHUB_BRANCH||"main";

function kstDate(d=new Date()){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
}
function baseUrl(req){
  const proto=req.headers["x-forwarded-proto"]||"https";
  const host=req.headers["x-forwarded-host"]||req.headers.host;
  return `${proto}://${host}`;
}
async function gh(url,options={}){
  if(!process.env.GITHUB_TOKEN)throw new Error("GITHUB_TOKEN missing");
  const r=await fetch(url,{...options,headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",...(options.headers||{})}});
  const text=await r.text();let j={};try{j=text?JSON.parse(text):{};}catch{}
  if(!r.ok)throw new Error(j?.message||`GitHub ${r.status}`);return j;
}
async function readFile(path){
  try{
    const j=await gh(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`);
    const text=Buffer.from(String(j.content||"").replace(/\n/g,""),"base64").toString("utf8");
    return {data:JSON.parse(text),sha:j.sha};
  }catch{return {data:null,sha:null};}
}
async function writeFile(path,obj,message){
  let sha=null;try{sha=(await readFile(path)).sha;}catch{}
  const body={message,content:Buffer.from(JSON.stringify(obj,null,2)+"\n","utf8").toString("base64"),branch:BRANCH};
  if(sha)body.sha=sha;
  return gh(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
}
function issueDate(obj){
  if(obj?.generatedDateKST)return obj.generatedDateKST;
  if(obj?.snapshotDateKST)return obj.snapshotDateKST;
  if(obj?.asOf){
    try{return kstDate(new Date(obj.asOf));}catch{}
  }
  return null;
}
async function archivePrevious(){
  const [m,n,a]=await Promise.all([readFile("market-current.json"),readFile("news-current.json"),readFile("ai-current.json")]);
  const today=kstDate();
  // Prefer AI/news issue date. This represents the actual newsletter issue.
  const date=issueDate(a.data)||issueDate(n.data)||issueDate(m.data);
  if(!date||date===today)return {archived:false,date};
  const indexFile=await readFile("archive/index.json");
  const index=indexFile.data||{dates:[]};
  const dates=Array.isArray(index.dates)?index.dates:[];
  if(!dates.includes(date)){
    if(m.data)await writeFile(`archive/${date}/market.json`,m.data,`Archive market ${date}`);
    if(n.data)await writeFile(`archive/${date}/news.json`,n.data,`Archive news ${date}`);
    if(a.data)await writeFile(`archive/${date}/ai.json`,a.data,`Archive AI ${date}`);
    dates.unshift(date);
    index.dates=[...new Set(dates)].sort().reverse().slice(0,365);
    index.updatedAt=new Date().toISOString();
    await writeFile("archive/index.json",index,`Archive index ${date}`);
  }
  return {archived:true,date};
}
async function call(url,options={}){
  const r=await fetch(url,options);const text=await r.text();let j={};try{j=text?JSON.parse(text):{};}catch{}
  if(!r.ok)throw new Error(j?.error||`${r.status} ${url}`);return j;
}
module.exports=async function(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
  if(process.env.CRON_SECRET&&req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return res.status(401).json({error:"Unauthorized"});
  const base=baseUrl(req),auth=req.headers.authorization?{Authorization:req.headers.authorization}:{};
  const out={ok:false,issueDateKST:kstDate(),schedule:"08:00 KST",startedAt:new Date().toISOString(),steps:{}};
  try{
    out.steps.archive=await archivePrevious();
    const market=await call(`${base}/api/market?force=1`,{headers:auth});
    out.steps.market={ok:true,date:market.snapshotDateKST};
    const news=await call(`${base}/api/news?force=1`,{headers:auth});
    out.steps.news={ok:true,date:news.generatedDateKST||null,count:news.items?.length||0};
    const ai=await call(`${base}/api/ai?force=1`,{method:"POST",headers:{...auth,"Content-Type":"application/json"},body:JSON.stringify({news:news.items||[],market:market.data||{}})});
    out.steps.ai={ok:true,date:ai.generatedDateKST||null};
    out.ok=true;out.finishedAt=new Date().toISOString();
    return res.status(200).json(out);
  }catch(e){
    out.error=e.message;out.finishedAt=new Date().toISOString();
    return res.status(500).json(out);
  }
};
