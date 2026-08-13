// File: /api/tariff.js
// DAILY cached tariff verification WITHOUT Gemini Google Search grounding.
//
// Why:
// Search grounding can hit a separate quota even when normal Gemini RPD remains available.
// This version:
// 1) Searches the public web through DuckDuckGo HTML.
// 2) Keeps ONLY official U.S. government URLs.
// 3) Fetches those official pages directly.
// 4) Sends the official-source excerpts to normal Gemini text generation.
// 5) Saves result to tariff-current.json for 24h.
// 6) On any failure, serves last verified saved data.
//
// MFN/base HTS duty is excluded from currentAdditionalRate.

const MODEL=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";
const GEMINI_BASE="https://generativelanguage.googleapis.com/v1beta/models";
const FILE_PATH="tariff-current.json";
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


const COPS=["Vietnam","Indonesia","Bangladesh","Cambodia","Nicaragua","Guatemala","Costa Rica","El Salvador","Haiti"];
const OFFICIAL_HOSTS=["ustr.gov","whitehouse.gov","federalregister.gov","cbp.gov","usitc.gov","hts.usitc.gov"];

function officialUrl(url=""){
  try{
    const h=new URL(url).hostname.toLowerCase();
    return OFFICIAL_HOSTS.some(x=>h===x||h.endsWith("."+x));
  }catch{return false;}
}
function decodeHtml(s=""){
  return s.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'")
    .replace(/&lt;/g,"<").replace(/&gt;/g,">");
}
function stripTags(s=""){return decodeHtml(s).replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();}
function ddgRealUrl(href=""){
  try{
    if(href.startsWith("//"))href="https:"+href;
    const u=new URL(href);
    const uddg=u.searchParams.get("uddg");
    return uddg?decodeURIComponent(uddg):href;
  }catch{return href;}
}
async function searchOfficial(query){
  const url=`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0"}});
  if(!r.ok)throw new Error(`Search ${r.status}`);
  const html=await r.text();
  const links=[];
  const re=/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while((m=re.exec(html))&&links.length<12){
    const real=ddgRealUrl(decodeHtml(m[1]));
    if(officialUrl(real))links.push({url:real,title:stripTags(m[2])});
  }
  return links;
}
async function fetchOfficialPage(item){
  const r=await fetch(item.url,{headers:{"User-Agent":"Mozilla/5.0"}});
  if(!r.ok)return null;
  const html=await r.text();
  const text=stripTags(html).slice(0,14000);
  return {title:item.title,url:item.url,text};
}
function uniq(arr){
  const seen=new Set();return arr.filter(x=>{if(!x?.url||seen.has(x.url))return false;seen.add(x.url);return true;});
}
async function collectSources(){
  const today=new Date().toISOString().slice(0,10);
  const queries=[
    `site:whitehouse.gov OR site:ustr.gov textile apparel tariff Section 301 July 2026 forced labor Vietnam Bangladesh Cambodia Indonesia ${today}`,
    `site:federalregister.gov textile apparel tariff TRQ Bangladesh Cambodia Indonesia 2026`,
    `site:cbp.gov textile apparel Chapter 99 Vietnam Bangladesh Cambodia Indonesia tariff 2026`,
    `site:ustr.gov Nicaragua Section 301 CAFTA apparel tariff 2026`,
    `site:usitc.gov OR site:hts.usitc.gov CAFTA DR Haiti HOPE HELP apparel 2026`,
    `site:whitehouse.gov reciprocal tariff apparel textile 2026 Vietnam`
  ];
  const sets=await Promise.allSettled(queries.map(searchOfficial));
  const links=uniq(sets.flatMap(x=>x.status==="fulfilled"?x.value:[])).slice(0,18);
  const pages=await Promise.allSettled(links.map(fetchOfficialPage));
  return pages.flatMap(x=>x.status==="fulfilled"&&x.value?[x.value]:[]);
}
function extractText(d){return(d?.candidates?.[0]?.content?.parts||[]).map(p=>p?.text||"").join("\n").trim();}
function stripFence(t){return String(t||"").replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();}
function sanitize(obj){
  const rows=Array.isArray(obj?.countries)?obj.countries:[];
  const out={
    ok:true,asOf:obj?.asOf||new Date().toISOString(),
    basis:"Additional U.S. import duties only; MFN/base HTS duty excluded",
    refreshStatus:"VERIFIED",stale:false,
    countries:rows.filter(x=>COPS.includes(x?.country)).map(x=>({
      country:x.country,
      currentAdditionalRate:Number.isFinite(Number(x.currentAdditionalRate))?Number(x.currentAdditionalRate):null,
      status:["CURRENT","PENDING","VERIFY"].includes(x.status)?x.status:"VERIFY",
      currentLabelKr:String(x.currentLabelKr||""),
      currentLabelEn:String(x.currentLabelEn||""),
      components:Array.isArray(x.components)?x.components.slice(0,6):[],
      preference:x.preference||{program:"",status:"VERIFY",noteKr:"",noteEn:""},
      trq:x.trq||{status:"VERIFY",effectiveDate:"",noteKr:"",noteEn:""},
      pending:Array.isArray(x.pending)?x.pending.slice(0,5):[],
      sources:Array.isArray(x.sources)?x.sources.filter(s=>officialUrl(String(s?.url||""))).slice(0,6):[]
    }))
  };
  for(const c of COPS){
    if(!out.countries.some(x=>x.country===c))out.countries.push({
      country:c,currentAdditionalRate:null,status:"VERIFY",
      currentLabelKr:"공식 소스 확인 필요",currentLabelEn:"Official-source verification required",
      components:[],preference:{program:"",status:"VERIFY",noteKr:"",noteEn:""},
      trq:{status:"VERIFY",effectiveDate:"",noteKr:"",noteEn:""},pending:[],sources:[]
    });
  }
  return out;
}

async function verify(){
  if(!process.env.GEMINI_API_KEY)throw new Error("GEMINI_API_KEY missing");

  const sources=await collectSources();
  if(!sources.length)throw new Error("No official U.S. government tariff sources could be fetched");

  const prompt=`
You are a U.S. tariff verification engine for an apparel vendor.

TODAY: ${new Date().toISOString().slice(0,10)}
Countries: ${COPS.join(", ")}

You are given excerpts fetched DIRECTLY from official U.S. government webpages.
Use ONLY those excerpts. Do not use outside knowledge.

Determine CURRENT U.S. additional import duties for general textile/apparel imports.

CRITICAL:
- EXCLUDE normal MFN/base HTS duty completely.
- currentAdditionalRate = only active incremental/additional duty above MFN/base HTS.
- If multiple currently active additional duties stack, sum them and list components.
- Future announced duties = PENDING, not included in currentAdditionalRate.
- TRQ is ACTIVE only when the supplied official text shows implementation is operating.
- CAFTA-DR / HOPE-HELP are preference programs and should be separate.
- Product/HTS-specific treatment that cannot be generalized across apparel = CONDITIONAL, not headline rate.
- If evidence is insufficient or conflicting, status VERIFY and null rate. NEVER guess.
- Prefer newer implementation/effective-date language over older announcements.

Verify especially:
- July 2026 forced-labor Section 301 action
- Bangladesh/Cambodia/Indonesia textile/apparel TRQ status
- Vietnam treatment
- Nicaragua separate Section 301 + CAFTA interaction
- CAFTA-DR: Nicaragua/Guatemala/Costa Rica/El Salvador
- Haiti HOPE/HELP
- any current reciprocal/emergency additional duty

Return ONLY JSON:
{
  "asOf":"ISO datetime",
  "countries":[
    {
      "country":"Vietnam",
      "currentAdditionalRate":12.5,
      "status":"CURRENT|PENDING|VERIFY",
      "currentLabelKr":"...",
      "currentLabelEn":"...",
      "components":[
        {"name":"...","rate":12.5,"status":"CURRENT|PENDING|EXEMPT|CONDITIONAL","effectiveDate":"YYYY-MM-DD or empty","noteKr":"...","noteEn":"..."}
      ],
      "preference":{"program":"...","status":"ACTIVE|NONE|CONDITIONAL|VERIFY","noteKr":"...","noteEn":"..."},
      "trq":{"status":"ACTIVE|PENDING|NOT ELIGIBLE|NONE|VERIFY","effectiveDate":"YYYY-MM-DD or empty","noteKr":"...","noteEn":"..."},
      "pending":[{"name":"...","rate":10,"effectiveDate":"YYYY-MM-DD","noteKr":"...","noteEn":"..."}],
      "sources":[{"title":"exact supplied official page title","url":"exact supplied URL"}]
    }
  ]
}

Return all 9 countries.

OFFICIAL SOURCE EXCERPTS:
${JSON.stringify(sources)}
`.trim();

  const r=await fetch(`${GEMINI_BASE}/${encodeURIComponent(MODEL)}:generateContent`,{
    method:"POST",
    headers:{"x-goog-api-key":process.env.GEMINI_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({
      contents:[{role:"user",parts:[{text:prompt}]}],
      generationConfig:{maxOutputTokens:7000,responseMimeType:"application/json"}
    })
  });
  const j=await r.json();
  if(!r.ok)throw new Error(j?.error?.message||`Gemini ${r.status}`);
  let parsed;try{parsed=JSON.parse(stripFence(extractText(j)));}catch{throw new Error("Gemini tariff JSON parsing failed");}
  return sanitize(parsed);
}

module.exports=async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});

  let saved=null,sha=null;
  try{const x=await readGithubJson(FILE_PATH);saved=x.data;sha=x.sha;}catch(e){console.error("[Tariff cache] read failed",e);}

  if(saved&&saved.refreshStatus==="VERIFIED"&&ageMs(saved.asOf)<MAX_AGE_MS){
    res.setHeader("Cache-Control","s-maxage=3600, stale-while-revalidate=7200");
    return res.status(200).json({...saved,stale:false,servedFrom:"saved"});
  }

  try{
    const fresh=await verify();
    try{await saveGithubJson(FILE_PATH,fresh,sha,`Daily tariff verification ${new Date().toISOString().slice(0,10)}`);}catch(e){console.error("[Tariff cache] save failed",e);}
    res.setHeader("Cache-Control","s-maxage=3600, stale-while-revalidate=7200");
    return res.status(200).json({...fresh,servedFrom:"fresh"});
  }catch(e){
    console.error("[Tariff cache] refresh failed",e);
    if(saved){
      return res.status(200).json({...saved,stale:true,refreshStatus:"STALE_FALLBACK",refreshError:e.message,servedFrom:"stale"});
    }
    return res.status(503).json({error:e?.message||"Tariff verification failed"});
  }
};
