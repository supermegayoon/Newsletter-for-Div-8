// api/ai-rebuild-once.js
// Manual one-time AI rebuild for the CURRENT KST issue.
// Does NOT touch issue number, archive, market, news, or competitor snapshots.
// Uses saved Market + News + Competitor data and rebuilds AI only.
// Safety: maximum once per KST date.

const OWNER=process.env.GITHUB_OWNER||"supermegayoon";
const REPO=process.env.GITHUB_REPO||"Newsletter-for-Div-8";
const BRANCH=process.env.GITHUB_BRANCH||"main";

function kstDate(d=new Date()){
  return new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Seoul",
    year:"numeric",month:"2-digit",day:"2-digit"
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
  let j={};
  try{j=text?JSON.parse(text):{}}catch{}
  if(!r.ok)throw new Error(j?.message||`GitHub ${r.status}`);
  return j;
}

async function readJson(path){
  const j=await gh(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`
  );
  return {
    data:JSON.parse(
      Buffer.from(
        String(j.content||"").replace(/\n/g,""),
        "base64"
      ).toString("utf8")
    ),
    sha:j.sha
  };
}

async function markerExists(path){
  try{
    await readJson(path);
    return true;
  }catch{
    return false;
  }
}

async function writeMarker(path,obj){
  const body={
    message:`Manual AI rebuild marker ${obj.issueDateKST}`,
    content:Buffer.from(
      JSON.stringify(obj,null,2)+"\n",
      "utf8"
    ).toString("base64"),
    branch:BRANCH
  };

  return gh(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
    {
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body)
    }
  );
}

async function callJson(url,options={}){
  const r=await fetch(url,options);
  const text=await r.text();
  let j={};
  try{j=text?JSON.parse(text):{}}catch{}
  if(!r.ok)throw new Error(j?.error||j?.message||`${r.status} ${url}`);
  return j;
}

module.exports=async function(req,res){
  if(req.method!=="GET"){
    return res.status(405).json({error:"Method not allowed"});
  }

  res.setHeader("Cache-Control","no-store");

  const today=kstDate();
  const markerPath=`manual-refresh/ai-${today}.json`;

  try{
    // Prevent repeated Gemini rebuilds on the same KST date.
    if(await markerExists(markerPath)){
      return res.status(200).json({
        ok:true,
        skipped:true,
        reason:"ALREADY_REBUILT_TODAY",
        issueDateKST:today,
        message:"Today's AI Insight has already been manually rebuilt once."
      });
    }

    const [publication,market,news,competitors]=await Promise.all([
      readJson("publication-current.json"),
      readJson("market-current.json"),
      readJson("news-current.json"),
      readJson("competitor-current.json")
    ]);

    const pub=publication.data;
    const m=market.data;
    const n=news.data;
    const c=competitors.data;

    // Strong consistency guard.
    const checks={
      publication:pub?.issueDateKST===today,
      market:m?.snapshotDateKST===today,
      news:n?.generatedDateKST===today,
      competitors:c?.generatedDateKST===today
    };

    const failed=Object.entries(checks)
      .filter(([,ok])=>!ok)
      .map(([name])=>name);

    if(failed.length){
      return res.status(409).json({
        ok:false,
        issueDateKST:today,
        error:`Cannot rebuild AI because current data is not fully aligned: ${failed.join(", ")}`,
        checks
      });
    }

    const base=baseUrl(req);
    const headers={"Content-Type":"application/json"};

    if(process.env.CRON_SECRET){
      headers.Authorization=`Bearer ${process.env.CRON_SECRET}`;
    }

    const ai=await callJson(
      `${base}/api/ai?force=1`,
      {
        method:"POST",
        headers,
        body:JSON.stringify({
          market:m.data||{},
          news:n.items||[],
          competitors:c
        })
      }
    );

    if(ai?.generatedDateKST!==today){
      throw new Error(
        `AI rebuild returned wrong date: ${ai?.generatedDateKST||"missing"}`
      );
    }

    const marker={
      ok:true,
      issueDateKST:today,
      issueNumber:pub.issueNumber,
      rebuiltAt:new Date().toISOString(),
      aiDateKST:ai.generatedDateKST,
      competitorDateKST:c.generatedDateKST,
      usesCompetitorIntelligence:
        ai.usesCompetitorIntelligence===true
    };

    await writeMarker(markerPath,marker);

    return res.status(200).json({
      ok:true,
      rebuilt:true,
      issueDateKST:today,
      issueNumber:pub.issueNumber,
      aiDateKST:ai.generatedDateKST,
      competitorDateKST:c.generatedDateKST,
      usesCompetitorIntelligence:
        ai.usesCompetitorIntelligence===true,
      message:"AI Insight rebuilt using today's Market, Buyer News, and Competitor Intelligence."
    });

  }catch(e){
    console.error("[AI rebuild once]",e);
    return res.status(500).json({
      ok:false,
      issueDateKST:today,
      error:e.message
    });
  }
};
