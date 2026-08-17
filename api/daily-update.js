// File: api/daily-update.js
// WEEKDAY ROBUST PUBLICATION + SELF-REPAIRING ISSUE NUMBER
//
// Issue number invariant:
// current issueNumber = number of archived published dates + 1
//
// This prevents legacy/mixed current files from being counted as extra issues.
// Example:
// archive = [2026-08-13, 2026-08-14] -> current 2026-08-17 = Issue #3.

const OWNER=process.env.GITHUB_OWNER||"supermegayoon";
const REPO=process.env.GITHUB_REPO||"Newsletter-for-Div-8";
const BRANCH=process.env.GITHUB_BRANCH||"main";
const RETENTION_DAYS=365;

const CURRENT_FILES=[
  "market-current.json",
  "news-current.json",
  "ai-current.json",
  "competitor-current.json",
  "publication-current.json"
];

function kstDate(d=new Date()){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
}
function kstWeekday(d=new Date()){
  return new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Seoul",weekday:"short"}).format(d);
}
function isWeekendKST(d=new Date()){
  const w=kstWeekday(d);return w==="Sat"||w==="Sun";
}
function baseUrl(req){
  const p=req.headers["x-forwarded-proto"]||"https";
  const h=req.headers["x-forwarded-host"]||req.headers.host;
  return `${p}://${h}`;
}
async function gh(url,o={}){
  if(!process.env.GITHUB_TOKEN)throw Error("GITHUB_TOKEN missing");
  const r=await fetch(url,{...o,headers:{
    Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,
    Accept:"application/vnd.github+json",
    "X-GitHub-Api-Version":"2022-11-28",
    ...(o.headers||{})
  }});
  const t=await r.text();let j={};try{j=t?JSON.parse(t):{}}catch{}
  if(!r.ok)throw Error(j?.message||`GitHub ${r.status}`);
  return j;
}
async function readFile(path){
  try{
    const j=await gh(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`);
    return{
      exists:true,
      data:JSON.parse(Buffer.from(String(j.content||"").replace(/\n/g,""),"base64").toString("utf8")),
      sha:j.sha
    };
  }catch{return{exists:false,data:null,sha:null}}
}
async function writeFile(path,obj,msg){
  const old=await readFile(path);
  const b={
    message:msg,
    content:Buffer.from(JSON.stringify(obj,null,2)+"\n","utf8").toString("base64"),
    branch:BRANCH
  };
  if(old.sha)b.sha=old.sha;
  return gh(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,{
    method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)
  });
}
async function deleteFile(path,msg){
  const old=await readFile(path);if(!old.sha)return false;
  await gh(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,{
    method:"DELETE",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({message:msg,sha:old.sha,branch:BRANCH})
  });return true;
}
async function snapshotCurrent(){
  const o={};for(const f of CURRENT_FILES)o[f]=await readFile(f);return o;
}
async function rollback(snapshot,today){
  const out={};
  for(const [path,s] of Object.entries(snapshot)){
    try{
      if(s.exists){await writeFile(path,s.data,`Rollback ${path} ${today}`);out[path]="restored";}
      else{await deleteFile(path,`Rollback ${path} ${today}`);out[path]="removed";}
    }catch(e){out[path]=`failed: ${e.message}`;}
  }
  return out;
}
function componentDate(path,o){
  if(!o)return null;
  if(path==="market-current.json")return o.snapshotDateKST||null;
  if(path==="publication-current.json")return o.issueDateKST||null;
  return o.generatedDateKST||null;
}
async function call(url,o={}){
  const r=await fetch(url,o),t=await r.text();let j={};try{j=t?JSON.parse(t):{}}catch{}
  if(!r.ok)throw Error(j?.error||j?.message||`${r.status} ${url}`);return j;
}
async function endpointExists(base,path,headers){
  try{const r=await fetch(`${base}${path}`,{headers});return r.status!==404}catch{return false}
}
async function archiveIndex(){
  const x=await readFile("archive/index.json");
  const index=x.data||{dates:[]};
  index.dates=Array.isArray(index.dates)?[...new Set(index.dates)].sort().reverse():[];
  return index;
}
function expectedCurrentIssueNumber(index){
  return (Array.isArray(index?.dates)?index.dates.length:0)+1;
}
function latestArchivedDate(index){
  return [...(index?.dates||[])].sort().reverse()[0]||null;
}
function cutoffDate(){
  return kstDate(new Date(Date.now()-RETENTION_DAYS*86400000));
}
async function purgeExpired(index){
  const cutoff=cutoffDate(),dates=index.dates||[];
  const keep=dates.filter(d=>d>=cutoff),expired=dates.filter(d=>d<cutoff);
  for(const date of expired){
    for(const f of["market.json","news.json","ai.json","competitor.json","publication.json"]){
      try{await deleteFile(`archive/${date}/${f}`,`Purge ${date} ${f}`)}catch{}
    }
  }
  index.dates=keep;
  index.retentionDays=RETENTION_DAYS;
  index.cutoffDateKST=cutoff;
  index.updatedAt=new Date().toISOString();
  return{index,expired};
}
async function repairSameDayPublication(pub,index,today){
  if(!pub||pub.issueDateKST!==today||pub.status!=="PUBLISHED")return null;

  const expected=expectedCurrentIssueNumber(index);
  const previous=latestArchivedDate(index);

  if(Number(pub.issueNumber)===expected && pub.previousIssueDateKST===previous){
    return{changed:false,publication:pub};
  }

  const repaired={
    ...pub,
    issueNumber:expected,
    issueLabel:expected===1?"창간호":`제${expected}호`,
    previousIssueDateKST:previous,
    repairedAt:new Date().toISOString(),
    repairReason:"Reconciled issue number from actual archive count"
  };
  await writeFile("publication-current.json",repaired,`Repair issue number ${today} to ${expected}`);
  return{changed:true,publication:repaired};
}
async function archivePrevious(snapshot,pub,index){
  if(!pub?.issueDateKST)return{archived:false,reason:"no previous publication",index};
  const date=pub.issueDateKST,today=kstDate();
  if(date===today)return{archived:false,date,reason:"already today",index};

  if(!index.dates.includes(date)){
    const mapping=[
      ["market-current.json","market.json"],
      ["news-current.json","news.json"],
      ["ai-current.json","ai.json"],
      ["competitor-current.json","competitor.json"]
    ];
    for(const [cur,arc] of mapping){
      const s=snapshot[cur];
      if(s?.data&&componentDate(cur,s.data)===date){
        await writeFile(`archive/${date}/${arc}`,s.data,`Archive ${arc} ${date}`);
      }
    }
    await writeFile(`archive/${date}/publication.json`,pub,`Archive publication ${date}`);
    index.dates.unshift(date);
    index.dates=[...new Set(index.dates)].sort().reverse();
  }

  const p=await purgeExpired(index);
  await writeFile("archive/index.json",p.index,`Archive index ${today}`);
  return{archived:true,date,retentionDays:RETENTION_DAYS,expiredRemoved:p.expired.length,index:p.index};
}
function validate(today,market,news,ai,comp,compRequired){
  const c={
    market:market?.snapshotDateKST===today,
    news:news?.generatedDateKST===today,
    ai:ai?.generatedDateKST===today
  };
  if(compRequired)c.competitors=comp?.generatedDateKST===today;
  const bad=Object.entries(c).filter(([,v])=>!v).map(([k])=>k);
  if(bad.length)throw Error(`Publication validation failed: ${bad.join(", ")}`);
  return c;
}

module.exports=async(req,res)=>{
  if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
  if(process.env.CRON_SECRET&&req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`){
    return res.status(401).json({error:"Unauthorized"});
  }

  const today=kstDate(),weekday=kstWeekday();
  if(isWeekendKST()){
    return res.status(200).json({
      ok:true,skipped:true,reason:"WEEKEND_NO_PUBLICATION",
      issueDateKST:today,weekdayKST:weekday,
      message:"Previous Friday edition remains live."
    });
  }

  const base=baseUrl(req),auth=req.headers.authorization?{Authorization:req.headers.authorization}:{};
  const out={
    ok:false,issueDateKST:today,weekdayKST:weekday,
    schedule:"Mon-Fri 08:00 KST",archiveRetentionDays:RETENTION_DAYS,
    startedAt:new Date().toISOString(),steps:{}
  };

  const snapshot=await snapshotCurrent();
  let index=await archiveIndex();
  const existingPub=snapshot["publication-current.json"]?.data;

  // Self-repair an already-published same-day issue before doing anything else.
  const repaired=await repairSameDayPublication(existingPub,index,today);
  if(repaired){
    out.ok=true;
    out.alreadyPublished=true;
    out.repaired=repaired.changed;
    out.status="PUBLISHED";
    out.issueNumber=repaired.publication.issueNumber;
    out.issueLabel=repaired.publication.issueLabel;
    out.previousIssueDateKST=repaired.publication.previousIssueDateKST;
    out.finishedAt=new Date().toISOString();
    return res.status(200).json(out);
  }

  // Legacy migration: previous publication = latest archive/current validated publication only.
  // NEVER infer an extra issue from a stray AI/news/current date.
  let previousPub=existingPub;
  if(!previousPub?.issueDateKST){
    const prevDate=latestArchivedDate(index);
    previousPub=prevDate?{
      ok:true,status:"PUBLISHED",issueDateKST:prevDate,
      issueNumber:index.dates.length,
      issueLabel:index.dates.length===1?"창간호":`제${index.dates.length}호`
    }:null;
  }

  try{
    const arch=await archivePrevious(snapshot,previousPub,index);
    out.steps.archive={...arch,index:undefined};
    index=arch.index||index;

    const market=await call(`${base}/api/market?force=1`,{headers:auth});
    out.steps.market={ok:true,date:market.snapshotDateKST};

    const news=await call(`${base}/api/news?force=1`,{headers:auth});
    out.steps.news={ok:true,date:news.generatedDateKST,count:news.items?.length||0};

    const ai=await call(`${base}/api/ai?force=1`,{
      method:"POST",
      headers:{...auth,"Content-Type":"application/json"},
      body:JSON.stringify({news:news.items||[],market:market.data||{}})
    });
    out.steps.ai={ok:true,date:ai.generatedDateKST};

    const compRequired=await endpointExists(base,"/api/competitors",auth);
    let comp=null;
    if(compRequired){
      comp=await call(`${base}/api/competitors?force=1`,{headers:auth});
      out.steps.competitors={ok:true,date:comp.generatedDateKST,buyers:comp.buyers?.length||0};
    }else{
      out.steps.competitors={ok:true,skipped:true,reason:"competitor API not deployed"};
    }

    out.steps.validation=validate(today,market,news,ai,comp,compRequired);

    // Re-read index after previous issue archival.
    index=await archiveIndex();
    const issueNumber=expectedCurrentIssueNumber(index);
    const previousIssueDateKST=latestArchivedDate(index);

    const publication={
      ok:true,status:"PUBLISHED",
      issueDateKST:today,
      issueNumber,
      issueLabel:issueNumber===1?"창간호":`제${issueNumber}호`,
      schedule:"Mon-Fri 08:00 KST",
      publishedAt:new Date().toISOString(),
      previousIssueDateKST,
      components:{
        marketDateKST:market.snapshotDateKST,
        marketDataDate:market.marketDataDate||null,
        newsDateKST:news.generatedDateKST,
        aiDateKST:ai.generatedDateKST,
        competitorDateKST:compRequired?comp.generatedDateKST:null
      }
    };

    await writeFile("publication-current.json",publication,`Publish issue ${issueNumber} ${today}`);

    out.ok=true;out.status="PUBLISHED";
    out.issueNumber=issueNumber;out.issueLabel=publication.issueLabel;
    out.previousIssueDateKST=previousIssueDateKST;
    out.finishedAt=new Date().toISOString();
    return res.status(200).json(out);

  }catch(e){
    out.error=e.message;out.status="ROLLED_BACK";
    out.rollback=await rollback(snapshot,today);
    out.finishedAt=new Date().toISOString();
    return res.status(500).json(out);
  }
};
