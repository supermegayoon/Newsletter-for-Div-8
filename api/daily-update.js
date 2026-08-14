// File: api/daily-update.js
// Daily flow: archive yesterday -> retain last 365 days -> Market -> News -> AI.
// Vercel Cron: 23:00 UTC = 08:00 KST.

const OWNER=process.env.GITHUB_OWNER||"supermegayoon";
const REPO=process.env.GITHUB_REPO||"Newsletter-for-Div-8";
const BRANCH=process.env.GITHUB_BRANCH||"main";
const RETENTION_DAYS=365;

function kstDate(d=new Date()){
  return new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"
  }).format(d);
}

function baseUrl(req){
  const proto=req.headers["x-forwarded-proto"]||"https";
  const host=req.headers["x-forwarded-host"]||req.headers.host;
  return `${proto}://${host}`;
}

async function gh(url,options={}){
  if(!process.env.GITHUB_TOKEN)throw new Error("GITHUB_TOKEN missing");
  const r=await fetch(url,{
    ...options,
    headers:{
      Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,
      Accept:"application/vnd.github+json",
      "X-GitHub-Api-Version":"2022-11-28",
      ...(options.headers||{})
    }
  });
  const text=await r.text();
  let j={};try{j=text?JSON.parse(text):{};}catch{}
  if(!r.ok)throw new Error(j?.message||`GitHub ${r.status}`);
  return j;
}

async function readFile(path){
  try{
    const j=await gh(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`);
    const text=Buffer.from(String(j.content||"").replace(/\n/g,""),"base64").toString("utf8");
    return {data:JSON.parse(text),sha:j.sha};
  }catch{
    return {data:null,sha:null};
  }
}

async function writeFile(path,obj,message){
  const old=await readFile(path);
  const body={
    message,
    content:Buffer.from(JSON.stringify(obj,null,2)+"\n","utf8").toString("base64"),
    branch:BRANCH
  };
  if(old.sha)body.sha=old.sha;

  return gh(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,{
    method:"PUT",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
}

async function deleteFile(path,message){
  const old=await readFile(path);
  if(!old.sha)return false;

  await gh(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,{
    method:"DELETE",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({message,sha:old.sha,branch:BRANCH})
  });
  return true;
}

function issueDate(obj){
  if(obj?.generatedDateKST)return obj.generatedDateKST;
  if(obj?.snapshotDateKST)return obj.snapshotDateKST;
  if(obj?.asOf){
    try{return kstDate(new Date(obj.asOf));}catch{}
  }
  return null;
}

function cutoffDate(){
  const now=new Date();
  // 365-day rolling retention by KST issue date.
  const cutoff=new Date(now.getTime()-RETENTION_DAYS*86400000);
  return kstDate(cutoff);
}

async function purgeExpired(index){
  const cutoff=cutoffDate();
  const dates=Array.isArray(index.dates)?index.dates:[];
  const keep=dates.filter(d=>d>=cutoff);
  const expired=dates.filter(d=>d<cutoff);

  for(const date of expired){
    for(const file of ["market.json","news.json","ai.json"]){
      try{
        await deleteFile(
          `archive/${date}/${file}`,
          `Purge expired archive ${date} ${file}`
        );
      }catch(e){
        console.error(`[Archive purge] ${date}/${file}`,e.message);
      }
    }
  }

  index.dates=keep;
  index.retentionDays=RETENTION_DAYS;
  index.cutoffDateKST=cutoff;
  index.updatedAt=new Date().toISOString();
  return {index,expired};
}

async function archivePrevious(){
  const [m,n,a]=await Promise.all([
    readFile("market-current.json"),
    readFile("news-current.json"),
    readFile("ai-current.json")
  ]);

  const today=kstDate();
  const date=issueDate(a.data)||issueDate(n.data)||issueDate(m.data);

  const indexFile=await readFile("archive/index.json");
  let index=indexFile.data||{dates:[]};

  let archived=false;

  if(date && date!==today){
    const dates=Array.isArray(index.dates)?index.dates:[];

    if(!dates.includes(date)){
      if(m.data)await writeFile(`archive/${date}/market.json`,m.data,`Archive market ${date}`);
      if(n.data)await writeFile(`archive/${date}/news.json`,n.data,`Archive news ${date}`);
      if(a.data)await writeFile(`archive/${date}/ai.json`,a.data,`Archive AI ${date}`);

      dates.unshift(date);
      index.dates=[...new Set(dates)].sort().reverse();
      archived=true;
    }
  }

  // Always enforce 365-day retention, even if today's run has nothing new to archive.
  const purged=await purgeExpired(index);
  index=purged.index;

  await writeFile("archive/index.json",index,`Archive index ${today}`);

  return {
    archived,
    date,
    retentionDays:RETENTION_DAYS,
    expiredRemoved:purged.expired.length
  };
}

async function call(url,options={}){
  const r=await fetch(url,options);
  const text=await r.text();
  let j={};try{j=text?JSON.parse(text):{};}catch{}
  if(!r.ok)throw new Error(j?.error||`${r.status} ${url}`);
  return j;
}

module.exports=async function(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});

  if(process.env.CRON_SECRET &&
     req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`){
    return res.status(401).json({error:"Unauthorized"});
  }

  const base=baseUrl(req);
  const auth=req.headers.authorization
    ? {Authorization:req.headers.authorization}
    : {};

  const out={
    ok:false,
    issueDateKST:kstDate(),
    schedule:"08:00 KST",
    archiveRetentionDays:RETENTION_DAYS,
    startedAt:new Date().toISOString(),
    steps:{}
  };

  try{
    out.steps.archive=await archivePrevious();

    const market=await call(`${base}/api/market?force=1`,{headers:auth});
    out.steps.market={ok:true,date:market.snapshotDateKST};

    const news=await call(`${base}/api/news?force=1`,{headers:auth});
    out.steps.news={
      ok:true,
      date:news.generatedDateKST||null,
      count:news.items?.length||0
    };

    const ai=await call(`${base}/api/ai?force=1`,{
      method:"POST",
      headers:{...auth,"Content-Type":"application/json"},
      body:JSON.stringify({
        news:news.items||[],
        market:market.data||{}
      })
    });

    out.steps.ai={ok:true,date:ai.generatedDateKST||null};

    out.ok=true;
    out.finishedAt=new Date().toISOString();
    return res.status(200).json(out);

  }catch(e){
    out.error=e.message;
    out.finishedAt=new Date().toISOString();
    return res.status(500).json(out);
  }
};
