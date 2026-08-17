// File: api/daily-update.js
// FINAL DAILY PUBLICATION ORDER
//
// KST Mon-Fri 08:00
// Archive -> Market -> News -> Competitor -> AI -> Validation -> Publish
//
// AI receives TODAY'S competitor snapshot explicitly.
// If any required step fails, all current files are rolled back.

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
  return new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Seoul",
    year:"numeric",month:"2-digit",day:"2-digit"
  }).format(d);
}

function kstWeekday(d=new Date()){
  return new Intl.DateTimeFormat("en-US",{
    timeZone:"Asia/Seoul",
    weekday:"short"
  }).format(d);
}

function isWeekendKST(d=new Date()){
  const w=kstWeekday(d);
  return w==="Sat"||w==="Sun";
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
  let j={};
  try{j=text?JSON.parse(text):{}}catch{}

  if(!r.ok)throw new Error(j?.message||`GitHub ${r.status}`);
  return j;
}

async function readFile(path){
  try{
    const j=await gh(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`
    );

    return{
      exists:true,
      data:JSON.parse(
        Buffer.from(
          String(j.content||"").replace(/\n/g,""),
          "base64"
        ).toString("utf8")
      ),
      sha:j.sha
    };
  }catch{
    return{exists:false,data:null,sha:null};
  }
}

async function writeFile(path,obj,message){
  const old=await readFile(path);

  const body={
    message,
    content:Buffer.from(
      JSON.stringify(obj,null,2)+"\n",
      "utf8"
    ).toString("base64"),
    branch:BRANCH
  };

  if(old.sha)body.sha=old.sha;

  return gh(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
    {
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body)
    }
  );
}

async function deleteFile(path,message){
  const old=await readFile(path);
  if(!old.sha)return false;

  await gh(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
    {
      method:"DELETE",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        message,
        sha:old.sha,
        branch:BRANCH
      })
    }
  );

  return true;
}

async function snapshotCurrent(){
  const out={};
  for(const path of CURRENT_FILES){
    out[path]=await readFile(path);
  }
  return out;
}

async function rollback(snapshot,today){
  const result={};

  for(const [path,snap] of Object.entries(snapshot)){
    try{
      if(snap.exists){
        await writeFile(
          path,
          snap.data,
          `Rollback ${path} after failed publication ${today}`
        );
        result[path]="restored";
      }else{
        await deleteFile(
          path,
          `Rollback new ${path} after failed publication ${today}`
        );
        result[path]="removed";
      }
    }catch(e){
      result[path]=`rollback failed: ${e.message}`;
    }
  }

  return result;
}

function componentDate(path,obj){
  if(!obj)return null;
  if(path==="market-current.json")return obj.snapshotDateKST||null;
  if(path==="publication-current.json")return obj.issueDateKST||null;
  return obj.generatedDateKST||null;
}

async function call(url,options={}){
  const r=await fetch(url,options);
  const text=await r.text();

  let j={};
  try{j=text?JSON.parse(text):{}}catch{}

  if(!r.ok){
    throw new Error(
      j?.error||
      j?.message||
      `${r.status} ${url}`
    );
  }

  return j;
}

async function archiveIndex(){
  const x=await readFile("archive/index.json");

  const index=x.data||{dates:[]};
  index.dates=Array.isArray(index.dates)
    ? [...new Set(index.dates)].sort().reverse()
    : [];

  return index;
}

function expectedCurrentIssueNumber(index){
  return (Array.isArray(index?.dates)?index.dates.length:0)+1;
}

function latestArchivedDate(index){
  return [...(index?.dates||[])].sort().reverse()[0]||null;
}

function cutoffDate(){
  return kstDate(
    new Date(Date.now()-RETENTION_DAYS*86400000)
  );
}

async function purgeExpired(index){
  const cutoff=cutoffDate();

  const dates=index.dates||[];
  const keep=dates.filter(d=>d>=cutoff);
  const expired=dates.filter(d=>d<cutoff);

  for(const date of expired){
    for(const file of[
      "market.json",
      "news.json",
      "ai.json",
      "competitor.json",
      "publication.json"
    ]){
      try{
        await deleteFile(
          `archive/${date}/${file}`,
          `Purge expired archive ${date} ${file}`
        );
      }catch{}
    }
  }

  index.dates=keep;
  index.retentionDays=RETENTION_DAYS;
  index.cutoffDateKST=cutoff;
  index.updatedAt=new Date().toISOString();

  return{index,expired};
}

async function repairSameDayPublication(pub,index,today){
  if(
    !pub||
    pub.issueDateKST!==today||
    pub.status!=="PUBLISHED"
  ){
    return null;
  }

  const expected=expectedCurrentIssueNumber(index);
  const previous=latestArchivedDate(index);

  if(
    Number(pub.issueNumber)===expected &&
    pub.previousIssueDateKST===previous
  ){
    return{
      changed:false,
      publication:pub
    };
  }

  const repaired={
    ...pub,
    issueNumber:expected,
    issueLabel:
      expected===1
        ?"창간호"
        :`제${expected}호`,
    previousIssueDateKST:previous,
    repairedAt:new Date().toISOString(),
    repairReason:
      "Reconciled issue number from actual archive count"
  };

  await writeFile(
    "publication-current.json",
    repaired,
    `Repair issue number ${today} to ${expected}`
  );

  return{
    changed:true,
    publication:repaired
  };
}

async function archivePrevious(snapshot,pub,index){
  if(!pub?.issueDateKST){
    return{
      archived:false,
      reason:"no previous publication",
      index
    };
  }

  const date=pub.issueDateKST;
  const today=kstDate();

  if(date===today){
    return{
      archived:false,
      date,
      reason:"already today",
      index
    };
  }

  if(!index.dates.includes(date)){
    const mapping=[
      ["market-current.json","market.json"],
      ["news-current.json","news.json"],
      ["ai-current.json","ai.json"],
      ["competitor-current.json","competitor.json"]
    ];

    for(const [currentName,archiveName] of mapping){
      const snap=snapshot[currentName];

      if(
        snap?.data &&
        componentDate(currentName,snap.data)===date
      ){
        await writeFile(
          `archive/${date}/${archiveName}`,
          snap.data,
          `Archive ${archiveName} ${date}`
        );
      }
    }

    await writeFile(
      `archive/${date}/publication.json`,
      pub,
      `Archive publication ${date}`
    );

    index.dates.unshift(date);
    index.dates=[
      ...new Set(index.dates)
    ].sort().reverse();
  }

  const purged=await purgeExpired(index);

  await writeFile(
    "archive/index.json",
    purged.index,
    `Archive index ${today}`
  );

  return{
    archived:true,
    date,
    retentionDays:RETENTION_DAYS,
    expiredRemoved:purged.expired.length,
    index:purged.index
  };
}

function validateToday(
  today,
  market,
  news,
  competitors,
  ai
){
  const checks={
    market:
      market?.snapshotDateKST===today,
    news:
      news?.generatedDateKST===today,
    competitors:
      competitors?.generatedDateKST===today,
    ai:
      ai?.generatedDateKST===today,
    aiUsesCompetitors:
      ai?.usesCompetitorIntelligence===true,
    aiCompetitorDate:
      ai?.competitorDateKST===today
  };

  const failed=Object.entries(checks)
    .filter(([,ok])=>!ok)
    .map(([name])=>name);

  if(failed.length){
    throw new Error(
      `Publication validation failed: ${failed.join(", ")}`
    );
  }

  return checks;
}

module.exports=async function(req,res){
  if(req.method!=="GET"){
    return res.status(405).json({
      error:"Method not allowed"
    });
  }

  if(
    process.env.CRON_SECRET &&
    req.headers.authorization!==
      `Bearer ${process.env.CRON_SECRET}`
  ){
    return res.status(401).json({
      error:"Unauthorized"
    });
  }

  const today=kstDate();
  const weekday=kstWeekday();

  // Defense in depth:
  // even if cron config changes, weekend never publishes.
  if(isWeekendKST()){
    return res.status(200).json({
      ok:true,
      skipped:true,
      reason:"WEEKEND_NO_PUBLICATION",
      issueDateKST:today,
      weekdayKST:weekday,
      message:
        "Saturday/Sunday KST: previous Friday edition remains live."
    });
  }

  const base=baseUrl(req);

  const auth=req.headers.authorization
    ?{Authorization:req.headers.authorization}
    :{};

  const out={
    ok:false,
    issueDateKST:today,
    weekdayKST:weekday,
    schedule:"Mon-Fri 08:00 KST",
    archiveRetentionDays:RETENTION_DAYS,
    publicationOrder:[
      "archive",
      "market",
      "news",
      "competitors",
      "ai",
      "validation",
      "publish"
    ],
    startedAt:new Date().toISOString(),
    steps:{}
  };

  const snapshot=await snapshotCurrent();
  let index=await archiveIndex();

  const existingPub=
    snapshot["publication-current.json"]?.data;

  // Same-day manual repeat:
  // do not create another issue.
  const repaired=await repairSameDayPublication(
    existingPub,
    index,
    today
  );

  if(repaired){
    out.ok=true;
    out.alreadyPublished=true;
    out.repaired=repaired.changed;
    out.status="PUBLISHED";
    out.issueNumber=
      repaired.publication.issueNumber;
    out.issueLabel=
      repaired.publication.issueLabel;
    out.previousIssueDateKST=
      repaired.publication.previousIssueDateKST;
    out.finishedAt=new Date().toISOString();

    return res.status(200).json(out);
  }

  // Legacy fallback for old projects.
  let previousPub=existingPub;

  if(!previousPub?.issueDateKST){
    const prevDate=latestArchivedDate(index);

    previousPub=prevDate
      ?{
          ok:true,
          status:"PUBLISHED",
          issueDateKST:prevDate,
          issueNumber:index.dates.length,
          issueLabel:
            index.dates.length===1
              ?"창간호"
              :`제${index.dates.length}호`
        }
      :null;
  }

  try{
    // 1. ARCHIVE PREVIOUS ISSUE
    const archive=await archivePrevious(
      snapshot,
      previousPub,
      index
    );

    out.steps.archive={
      ...archive,
      index:undefined
    };

    index=archive.index||index;

    // 2. MARKET
    const market=await call(
      `${base}/api/market?force=1`,
      {headers:auth}
    );

    out.steps.market={
      ok:true,
      date:market.snapshotDateKST
    };

    // 3. BUYER NEWS
    const news=await call(
      `${base}/api/news?force=1`,
      {headers:auth}
    );

    out.steps.news={
      ok:true,
      date:news.generatedDateKST,
      count:news.items?.length||0
    };

    // 4. COMPETITOR INTELLIGENCE
    // IMPORTANT: runs BEFORE AI.
    const competitors=await call(
      `${base}/api/competitors?force=1`,
      {headers:auth}
    );

    out.steps.competitors={
      ok:true,
      date:competitors.generatedDateKST,
      buyers:competitors.buyers?.length||0,
      signals:
        (competitors.buyers||[])
          .reduce(
            (sum,b)=>
              sum+(b.competitors?.length||0),
            0
          )
    };

    // 5. AI INSIGHT
    // IMPORTANT:
    // explicitly passes TODAY'S competitor object
    // rather than relying only on saved GitHub state.
    const ai=await call(
      `${base}/api/ai?force=1`,
      {
        method:"POST",
        headers:{
          ...auth,
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          news:news.items||[],
          market:market.data||{},
          competitors
        })
      }
    );

    out.steps.ai={
      ok:true,
      date:ai.generatedDateKST,
      usesCompetitorIntelligence:
        ai.usesCompetitorIntelligence===true,
      competitorDateKST:
        ai.competitorDateKST||null
    };

    // 6. STRONG VALIDATION
    out.steps.validation=validateToday(
      today,
      market,
      news,
      competitors,
      ai
    );

    // Re-read archive index after previous issue archive.
    index=await archiveIndex();

    const issueNumber=
      expectedCurrentIssueNumber(index);

    const previousIssueDateKST=
      latestArchivedDate(index);

    // 7. PUBLISH ONLY AFTER ALL CHECKS PASS
    const publication={
      ok:true,
      status:"PUBLISHED",
      issueDateKST:today,
      issueNumber,
      issueLabel:
        issueNumber===1
          ?"창간호"
          :`제${issueNumber}호`,
      schedule:"Mon-Fri 08:00 KST",
      publishedAt:new Date().toISOString(),
      previousIssueDateKST,
      components:{
        marketDateKST:
          market.snapshotDateKST,
        marketDataDate:
          market.marketDataDate||null,
        newsDateKST:
          news.generatedDateKST,
        competitorDateKST:
          competitors.generatedDateKST,
        aiDateKST:
          ai.generatedDateKST,
        aiUsesCompetitorIntelligence:
          ai.usesCompetitorIntelligence===true
      }
    };

    await writeFile(
      "publication-current.json",
      publication,
      `Publish issue ${issueNumber} ${today}`
    );

    out.ok=true;
    out.status="PUBLISHED";
    out.issueNumber=issueNumber;
    out.issueLabel=publication.issueLabel;
    out.previousIssueDateKST=
      previousIssueDateKST;
    out.finishedAt=new Date().toISOString();

    return res.status(200).json(out);

  }catch(e){
    out.error=e.message;
    out.status="ROLLED_BACK";

    // Restore all current snapshots if anything fails.
    out.rollback=await rollback(
      snapshot,
      today
    );

    out.finishedAt=new Date().toISOString();

    return res.status(500).json(out);
  }
};
