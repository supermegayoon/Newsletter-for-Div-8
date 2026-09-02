// File: /api/trend.js
// DAILY TREND RADAR — shared KST daily cache.
// Fixes the old hard-coded July Trend Radar in index.html.
//
// Data collection:
// - Google News RSS, max 30 days
// - Trade-policy terms + buyer/apparel signals
// - Normal Gemini text generation only (NO Google Search grounding)
// - Saves trend-current.json in GitHub
//
// Normal visitors read the same saved result.
// At most one Gemini refresh per KST day.

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const FILE_PATH = "trend-current.json";

const OWNER = process.env.GITHUB_OWNER || "supermegayoon";
const REPO = process.env.GITHUB_REPO || "Newsletter-for-Div-8";
const BRANCH = process.env.GITHUB_BRANCH || "main";

function kstDate(date=new Date()){
  return new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"
  }).format(date);
}

async function gh(url,options={}){
  if(!process.env.GITHUB_TOKEN)throw new Error("GITHUB_TOKEN missing");
  const r=await fetch(url,{
    ...options,
    headers:{
      "Authorization":`Bearer ${process.env.GITHUB_TOKEN}`,
      "Accept":"application/vnd.github+json",
      "X-GitHub-Api-Version":"2022-11-28",
      ...(options.headers||{})
    }
  });
  const text=await r.text();let j={};try{j=text?JSON.parse(text):{};}catch{}
  if(!r.ok)throw new Error(j?.message||`GitHub ${r.status}`);
  return j;
}

async function readSaved(){
  const url=`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${encodeURIComponent(BRANCH)}`;
  const j=await gh(url);
  const content=Buffer.from(String(j.content||"").replace(/\n/g,""),"base64").toString("utf8");
  return {data:JSON.parse(content),sha:j.sha};
}

async function saveSaved(obj,sha){
  const url=`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
  const content=Buffer.from(JSON.stringify(obj,null,2)+"\n","utf8").toString("base64");
  const body={
    message:`Daily Trend Radar ${obj.generatedDateKST}`,
    content,branch:BRANCH
  };
  if(sha)body.sha=sha;
  return gh(url,{
    method:"PUT",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
}

function decodeXml(s=""){
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1")
    .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/&lt;/g,"<").replace(/&gt;/g,">");
}
function stripTags(s=""){return decodeXml(s).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();}
function tag(block,name){
  const m=block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,"i"));
  return m?stripTags(m[1]):"";
}
function linkTag(block){
  const m=block.match(/<link>([\s\S]*?)<\/link>/i);
  return m?decodeXml(m[1]).trim():"";
}
function sourceTag(block){
  const m=block.match(/<source(?:\s+url="([^"]*)")?>([\s\S]*?)<\/source>/i);
  return m?stripTags(m[2]||""):"Google News";
}
function ageHours(date){
  const ms=Date.now()-new Date(date).getTime();
  return Number.isFinite(ms)?ms/36e5:99999;
}
function keyTitle(t=""){
  return t.toLowerCase().replace(/\s+-\s+[^-]{2,50}$/,"")
    .replace(/[^a-z0-9가-힣]+/g," ").trim();
}

const SEARCHES = [
  'Haiti HOPE HELP AGOA apparel extension Congress',
  'Section 301 forced labor tariff apparel textile Vietnam Bangladesh Cambodia Indonesia',
  'textile apparel TRQ Bangladesh Cambodia Indonesia tariff',
  'CAFTA DR apparel tariff Nicaragua Guatemala Costa Rica El Salvador',
  'Kohl\'s apparel strategy promotion earnings',
  'Abercrombie Hollister apparel strategy wholesale earnings',
  'Macy\'s apparel strategy promotion earnings',
  'US apparel retail consumer demand fashion trend'
];

async function rss(q){
  const url=`https://news.google.com/rss/search?q=${encodeURIComponent(q+" when:30d")}&hl=en-US&gl=US&ceid=US:en`;
  const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0"}});
  if(!r.ok)throw new Error(`Google News RSS ${r.status}`);
  const xml=await r.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>{
    const b=m[1],date=tag(b,"pubDate");
    return {
      title:tag(b,"title"),
      description:tag(b,"description"),
      source:sourceTag(b),
      sourceUrl:linkTag(b),
      pubDate:date,
      ageHours:ageHours(date)
    };
  }).filter(x=>x.title&&x.ageHours<=24*30+12);
}

function dedupe(items){
  const seen=new Set(),out=[];
  for(const x of items.sort((a,b)=>a.ageHours-b.ageHours)){
    const k=keyTitle(x.title);if(!k||seen.has(k))continue;
    seen.add(k);out.push(x);
  }
  return out;
}
function extractText(d){return(d?.candidates?.[0]?.content?.parts||[]).map(p=>p?.text||"").join("\n").trim();}
function stripFence(t){return String(t||"").replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();}

async function buildFresh(){
  const sets=await Promise.allSettled(SEARCHES.map(rss));
  const raw=dedupe(sets.flatMap(x=>x.status==="fulfilled"?x.value:[])).slice(0,45);
  if(!raw.length)throw new Error("No Trend Radar source items");

  const prompt=`
You create the DAILY "Trend Radar" for a Korean apparel vendor sales team.

TODAY: ${new Date().toISOString()}
Use ONLY the supplied news items. Do not invent facts.

The old page had static July cards. Replace them with 3-4 CURRENT strategic signals.

PRIORITY:
1. U.S. apparel trade policy that materially changes sourcing decisions:
   Haiti HOPE/HELP, AGOA, Section 301, apparel/textile TRQ, CAFTA-DR.
2. Important buyer strategy for Kohl's, A&F/Hollister, Macy's.
3. Broader apparel demand/product trend only if actionable.

FRESHNESS:
- <=72h highest
- 4-7d second
- 8-30d only for still-relevant context.
- Never say a bill is law if the source only says House/Senate/Congress passed it and presidential signature is still pending.
- Specifically distinguish: passed Congress / awaiting signature / signed into law / effective.

APPAREL VENDOR LENS:
Every card must say what Sales/Merchandising/Sourcing should do next.
Avoid generic "monitor."
For Haiti, distinguish current duty-free HOPE/HELP treatment from a future extension pending signature where applicable.

KOREAN STYLE:
Natural Korean business language, but keep common terms such as apparel, sourcing, capacity, duty-free, Section 301, TRQ, CAFTA-DR, HOPE/HELP, margin, costing in English where natural.

Return ONLY JSON:
[
 {
  "level":"HIGH|MEDIUM",
  "title_kr":"...",
  "title_en":"...",
  "body_kr":"1-2 sentences",
  "body_en":"1-2 sentences",
  "action_kr":"specific action",
  "action_en":"specific action",
  "source":"publisher",
  "sourceUrl":"exact input URL",
  "date":"YYYY.MM.DD"
 }
]

Maximum 4 cards.

RAW:
${JSON.stringify(raw)}
`.trim();

  const r=await fetch(`${GEMINI_BASE}/${encodeURIComponent(MODEL)}:generateContent`,{
    method:"POST",
    headers:{
      "x-goog-api-key":process.env.GEMINI_API_KEY,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      contents:[{role:"user",parts:[{text:prompt}]}],
      generationConfig:{
        temperature:0.25,
        maxOutputTokens:3200,
        responseMimeType:"application/json"
      }
    })
  });
  const j=await r.json();
  if(!r.ok)throw new Error(j?.error?.message||`Gemini ${r.status}`);
  const items=JSON.parse(stripFence(extractText(j)));

  return {
    ok:true,
    asOf:new Date().toISOString(),
    generatedDateKST:kstDate(),
    refreshStatus:"VERIFIED",
    stale:false,
    items:Array.isArray(items)?items.slice(0,4):[]
  };
}

module.exports=async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});

  let saved=null,sha=null;
  try{const x=await readSaved();saved=x.data;sha=x.sha;}catch(e){console.error("[Trend] saved read failed",e);}

  // Same KST date = always show shared fixed result. No extra Gemini calls.
  if(saved?.generatedDateKST===kstDate()&&saved?.items?.length){
    res.setHeader("Cache-Control","s-maxage=1800, stale-while-revalidate=7200");
    return res.status(200).json({...saved,servedFrom:"saved"});
  }

  try{
    const fresh=await buildFresh();
    try{await saveSaved(fresh,sha);}catch(e){console.error("[Trend] GitHub save failed",e);}
    res.setHeader("Cache-Control","s-maxage=1800, stale-while-revalidate=7200");
    return res.status(200).json({...fresh,servedFrom:"fresh"});
  }catch(e){
    if(saved?.items?.length){
      return res.status(200).json({
        ...saved,stale:true,refreshStatus:"STALE_FALLBACK",
        refreshError:e?.message||"Trend refresh failed",servedFrom:"stale"
      });
    }
    return res.status(503).json({error:e?.message||"Trend refresh failed"});
  }
};
