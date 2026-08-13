// File: /api/ai.js
// DAILY shared AI Market Insight cache.
// Gemini is used at most once per 24 hours.
// Every visitor sees the same ai-current.json result.

const MODEL=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";
const GEMINI_BASE="https://generativelanguage.googleapis.com/v1beta/models";
const FILE_PATH="ai-current.json";
const MAX_AGE_MS=24*60*60*1000;


const OWNER = process.env.GITHUB_OWNER || "supermegayoon";
const REPO = process.env.GITHUB_REPO || "Newsletter-for-Div-8";
const BRANCH = process.env.GITHUB_BRANCH || "main";

async function gh(url, options={}) {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN missing");
  const r = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });
  const text = await r.text();
  let j = {};
  try { j = text ? JSON.parse(text) : {}; } catch {}
  if (!r.ok) throw new Error(j?.message || `GitHub ${r.status}`);
  return j;
}

async function readGithubJson(path) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`;
  const j = await gh(url);
  const content = Buffer.from(String(j.content || "").replace(/\n/g, ""), "base64").toString("utf8");
  return { data: JSON.parse(content), sha: j.sha };
}

async function saveGithubJson(path, obj, sha, message) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
  const content = Buffer.from(JSON.stringify(obj, null, 2) + "\n", "utf8").toString("base64");
  const body = { message, content, branch: BRANCH };
  if (sha) body.sha = sha;
  return gh(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

function ageMs(asOf) {
  const t = new Date(asOf || 0).getTime();
  return Number.isFinite(t) ? Date.now() - t : Number.MAX_SAFE_INTEGER;
}


function clean(v,max=1600){return String(v??"").replace(/\s+/g," ").trim().slice(0,max);}
function normNews(n){
  if(!Array.isArray(n))return[];
  return n.slice(0,20).map(x=>({
    brand:clean(x.brandLabel||x.brand,80),date:clean(x.date,30),
    title_kr:clean(x.title_kr,260),title_en:clean(x.title_en,260),
    body_kr:clean(x.body_kr,700),body_en:clean(x.body_en,700),source:clean(x.source,100),
    ageHours:Number.isFinite(Number(x.ageHours))?Number(x.ageHours):null
  }));
}
function normMarket(m){
  if(!m||typeof m!=="object")return{};
  const allowed=["KSS","ANF","M","KRW=X","CTZ26.NYB","CL=F","BZ=F"],out={};
  for(const s of allowed){const d=m[s];if(!d)continue;out[s]={price:Number.isFinite(Number(d.price))?Number(d.price):null,changePct:Number.isFinite(Number(d.changePct))?Number(d.changePct):null};}
  return out;
}
function extract(d){return(d?.candidates?.[0]?.content?.parts||[]).map(p=>p?.text||"").join("\n").trim();}
function strip(t){return String(t||"").replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();}

async function generate(body){
  if(!process.env.GEMINI_API_KEY)throw new Error("GEMINI_API_KEY missing");
  const news=normNews(body.news),market=normMarket(body.market);
  const prompt=`
You are the strategy analyst for "8담당 DAILY MARKET BRIEF".

Goal:
Turn supplied buyer/retailer news into practical apparel-vendor sales actions.
Buyer strategy first; raw materials/FX/oil only when materially relevant.

Main buyers: Kohl's, A&F/Hollister, Macy's.
Use other retailers only when strategically useful.

Think:
NEWS SIGNAL -> COMMERCIAL IMPLICATION -> SPECIFIC VENDOR ACTION.

Rules:
- Analyze only supplied data.
- Do not invent orders, inventory, buyer plans, category sales, tariffs or demand.
- Stock price is supporting sentiment only.
- Prefer specific actions: propose, prepare, connect, validate, follow up, prioritize.
- Avoid generic "monitor the market."
- Actions must be executable by sales/merchandising.
- Return Korean + English.

Return ONLY JSON:
{
  "headline":{"kr":"...","en":"..."},
  "buyerInsights":[
    {"buyer":"Kohl's","kr":"...","en":"..."},
    {"buyer":"A&F / Hollister","kr":"...","en":"..."},
    {"buyer":"Macy's","kr":"...","en":"..."}
  ],
  "opportunities":[
    {"kr":"...","en":"..."},
    {"kr":"...","en":"..."},
    {"kr":"...","en":"..."}
  ],
  "risk":{"level":"LOW|MEDIUM|HIGH","kr":"...","en":"..."},
  "actions":[
    {"owner":"...","kr":"...","en":"..."},
    {"owner":"...","kr":"...","en":"..."},
    {"owner":"...","kr":"...","en":"..."}
  ]
}

Headline: ${clean(body.headline,300)}
Summary: ${clean(body.summary,1800)}
Market: ${JSON.stringify(market)}
News: ${JSON.stringify(news)}
`.trim();

  const r=await fetch(`${GEMINI_BASE}/${encodeURIComponent(MODEL)}:generateContent`,{
    method:"POST",
    headers:{"x-goog-api-key":process.env.GEMINI_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({
      contents:[{role:"user",parts:[{text:prompt}]}],
      generationConfig:{maxOutputTokens:2600,responseMimeType:"application/json"}
    })
  });
  const j=await r.json();
  if(!r.ok)throw new Error(j?.error?.message||`Gemini ${r.status}`);
  let insight;try{insight=JSON.parse(strip(extract(j)));}catch{throw new Error("Gemini JSON parsing failed");}
  return {ok:true,asOf:new Date().toISOString(),refreshStatus:"VERIFIED",stale:false,provider:"Google Gemini",model:MODEL,insight};
}

module.exports=async function handler(req,res){
  let saved=null,sha=null;
  try{const x=await readGithubJson(FILE_PATH);saved=x.data;sha=x.sha;}catch(e){console.error("[AI cache] read failed",e);}

  if(req.method==="GET"){
    if(saved){
      return res.status(200).json({
        ...saved,
        stale:ageMs(saved.asOf)>=MAX_AGE_MS,
        nextRefreshAt:new Date(new Date(saved.asOf).getTime()+MAX_AGE_MS).toISOString(),
        servedFrom:"saved"
      });
    }
    return res.status(503).json({error:"No saved AI insight exists yet."});
  }

  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});

  if(saved&&saved.refreshStatus==="VERIFIED"&&ageMs(saved.asOf)<MAX_AGE_MS){
    return res.status(200).json({
      ...saved,stale:false,
      nextRefreshAt:new Date(new Date(saved.asOf).getTime()+MAX_AGE_MS).toISOString(),
      servedFrom:"saved"
    });
  }

  try{
    const fresh=await generate(req.body||{});
    try{await saveGithubJson(FILE_PATH,fresh,sha,`Daily AI insight ${new Date().toISOString().slice(0,10)}`);}catch(e){console.error("[AI cache] save failed",e);}
    return res.status(200).json({
      ...fresh,
      nextRefreshAt:new Date(new Date(fresh.asOf).getTime()+MAX_AGE_MS).toISOString(),
      servedFrom:"fresh"
    });
  }catch(e){
    console.error("[AI cache] refresh failed",e);
    if(saved){
      return res.status(200).json({...saved,stale:true,refreshStatus:"STALE_FALLBACK",refreshError:e.message,servedFrom:"stale"});
    }
    return res.status(503).json({error:e?.message||"AI refresh failed"});
  }
};
