// File: /api/tariff.js
// DIRECT-OFFICIAL DAILY TARIFF WATCH
//
// Fix for "No official U.S. government tariff sources could be fetched":
// - No DuckDuckGo
// - No Gemini Google Search grounding
// - Fetches known official U.S. source pages directly
// - Crawls official USTR/White House index pages for newly published tariff/Section 301 links
// - Queries the Federal Register public API (no API key) for new implementation notices
// - Uses normal Gemini text generation only once per 24h
// - Saves result in tariff-current.json and serves it to everyone
//
// MFN/base HTS duty is excluded.

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const OWNER = process.env.GITHUB_OWNER || "supermegayoon";
const REPO = process.env.GITHUB_REPO || "Newsletter-for-Div-8";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const FILE_PATH = "tariff-current.json";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const COPS = ["Vietnam","Indonesia","Bangladesh","Cambodia","Nicaragua","Guatemala","Costa Rica","El Salvador","Haiti"];

const CORE_URLS = [
  "https://ustr.gov/about/policy-offices/press-office/press-releases/2026/july/ustr-takes-action-forced-labor-section-301-investigations",
  "https://ustr.gov/about/policy-offices/press-office/fact-sheets/2026/july/fact-sheet-ustr-section-301-action-response-failure-60-economies-ban-imports-produced-forced-labor",
  "https://ustr.gov/trade-topics/enforcement/section-301-investigations/section-301-failure-impose-and-effectively-enforce-prohibition-importation-goods-produced-forced",
  "https://www.whitehouse.gov/presidential-actions/2026/07/actions-by-the-united-states-in-the-investigations-under-section-301-of-the-trade-act-of-1974-of-the-acts-policies-and-practices-of-60-economies-related-to-the-failure-of-each-economy-to-impose-and/",
  "https://ustr.gov/about/policy-offices/press-office/press-releases/2025/december/ustr-section-301-action-nicaraguas-acts-policies-and-practices-relating-labor-rights-human-rights",
  "https://ustr.gov/trade-topics/enforcement/section-301-investigations/section-301-nicaragua-labor-rights-human-rights-and-rule-law",
  "https://www.whitehouse.gov/presidential-actions/2026/02/imposing-a-temporary-import-surcharge-to-address-fundamental-international-payments-problems/",
  "https://www.whitehouse.gov/presidential-actions/2026/02/ending-certain-tariff-actions/",
  "https://www.trade.gov/haiti-trade-preference",
  "https://www.trade.gov/haiti-trade-preference-program-frequently-asked-questions"
];

const INDEX_URLS = [
  "https://ustr.gov/category/document-type/press-release?page=0",
  "https://ustr.gov/about/policy-offices/press-office/fact-sheets/2026",
  "https://www.whitehouse.gov/presidential-actions/",
  "https://www.whitehouse.gov/presidential-actions/presidential-memoranda/"
];

function ageMs(asOf){
  const t=new Date(asOf||0).getTime();
  return Number.isFinite(t)?Date.now()-t:Number.MAX_SAFE_INTEGER;
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
  const body={message:`Daily tariff verification ${new Date().toISOString().slice(0,10)}`,content,branch:BRANCH};
  if(sha)body.sha=sha;
  return gh(url,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
}
function stripTags(html=""){
  return html
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;/g," ")
    .replace(/&amp;/g,"&")
    .replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'")
    .replace(/\s+/g," ")
    .trim();
}
function official(url=""){
  try{
    const h=new URL(url).hostname.toLowerCase();
    return h==="ustr.gov"||h.endsWith(".ustr.gov")||
           h==="whitehouse.gov"||h.endsWith(".whitehouse.gov")||
           h==="federalregister.gov"||h.endsWith(".federalregister.gov")||
           h==="cbp.gov"||h.endsWith(".cbp.gov")||
           h==="usitc.gov"||h.endsWith(".usitc.gov")||
           h==="hts.usitc.gov"||h==="trade.gov"||h.endsWith(".trade.gov");
  }catch{return false;}
}
async function fetchPage(url){
  const r=await fetch(url,{
    redirect:"follow",
    headers:{"User-Agent":"Mozilla/5.0 (compatible; Team8TariffWatch/1.0)","Accept":"text/html,application/xhtml+xml"}
  });
  if(!r.ok)throw new Error(`${new URL(url).hostname} ${r.status}`);
  const html=await r.text();
  return {url:r.url||url,html,text:stripTags(html).slice(0,18000)};
}
function extractOfficialLinks(page){
  const out=[],base=page.url;
  const re=/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while((m=re.exec(page.html))&&out.length<40){
    try{
      const u=new URL(m[1],base).href;
      const label=stripTags(m[2]);
      if(!official(u))continue;
      if(!/(tariff|section 301|forced labor|trade|trq|textile|apparel|nicaragua|haiti|cafta)/i.test(label+" "+u))continue;
      out.push({url:u,title:label||u});
    }catch{}
  }
  return out;
}
async function federalRegisterLinks(){
  // Federal Register API is public/no-key.
  const terms=[
    '"forced labor" Section 301',
    'textile apparel TRQ Bangladesh Cambodia Indonesia',
    'Nicaragua Section 301',
    'Haiti apparel trade preference'
  ];
  const all=[];
  for(const term of terms){
    try{
      const u=`https://www.federalregister.gov/api/v1/documents.json?per_page=10&order=newest&conditions%5Bterm%5D=${encodeURIComponent(term)}&conditions%5Bagencies%5D%5B%5D=trade-representative-office-of-united-states`;
      const r=await fetch(u,{headers:{"User-Agent":"Team8TariffWatch/1.0"}});
      if(!r.ok)continue;
      const j=await r.json();
      for(const x of j.results||[]){
        if(x.html_url)all.push({url:x.html_url,title:x.title||"Federal Register notice"});
      }
    }catch{}
  }
  return all;
}
function uniqueLinks(arr){
  const seen=new Set(),out=[];
  for(const x of arr){
    const u=String(x.url||"").split("#")[0];
    if(!u||seen.has(u)||!official(u))continue;
    seen.add(u);out.push({...x,url:u});
  }
  return out;
}
async function collectSources(){
  const docs=[];

  // 1) Known authoritative core documents — robust and no discovery dependency.
  const core=await Promise.allSettled(CORE_URLS.map(fetchPage));
  for(const x of core)if(x.status==="fulfilled")docs.push({title:x.value.url,url:x.value.url,text:x.value.text});

  // 2) Official index pages — discover newly posted government actions.
  const indexes=await Promise.allSettled(INDEX_URLS.map(fetchPage));
  let links=[];
  for(const x of indexes){
    if(x.status==="fulfilled")links.push(...extractOfficialLinks(x.value));
  }

  // 3) Federal Register public API — discover implementation notices/TRQ effective dates.
  links.push(...await federalRegisterLinks());
  links=uniqueLinks(links).slice(0,18);

  const extra=await Promise.allSettled(links.map(x=>fetchPage(x.url).then(p=>({title:x.title,url:p.url,text:p.text}))));
  for(const x of extra)if(x.status==="fulfilled")docs.push(x.value);

  // Deduplicate and keep token size controlled.
  const seen=new Set(),out=[];
  for(const d of docs){
    if(seen.has(d.url))continue;
    seen.add(d.url);
    out.push({title:d.title,url:d.url,text:d.text.slice(0,12000)});
  }
  return out.slice(0,22);
}
function extractText(d){return(d?.candidates?.[0]?.content?.parts||[]).map(p=>p?.text||"").join("\n").trim();}
function stripFence(t){return String(t||"").replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();}
function sanitize(obj){
  const rows=Array.isArray(obj?.countries)?obj.countries:[];
  const out={
    ok:true,asOf:new Date().toISOString(),
    basis:"APPAREL MODE: current effective duty treatment for qualifying apparel; FTA/preference base duty reflected.",mode:"APPAREL",
    refreshStatus:"VERIFIED",stale:false,
    countries:rows.filter(x=>COPS.includes(x?.country)).map(x=>({
      country:x.country,
      apparelEffectiveRate:Number.isFinite(Number(x.apparelEffectiveRate))?Number(x.apparelEffectiveRate):(Number.isFinite(Number(x.currentAdditionalRate))?Number(x.currentAdditionalRate):null),
      currentAdditionalRate:Number.isFinite(Number(x.currentAdditionalRate))?Number(x.currentAdditionalRate):null,
      status:["CURRENT","PENDING","VERIFY"].includes(x.status)?x.status:"VERIFY",
      currentLabelKr:String(x.currentLabelKr||""),
      currentLabelEn:String(x.currentLabelEn||""),
      components:Array.isArray(x.components)?x.components.slice(0,6):[],
      preference:x.preference||{program:"",status:"VERIFY",noteKr:"",noteEn:""},
      trq:x.trq||{status:"VERIFY",effectiveDate:"",noteKr:"",noteEn:""},
      pending:Array.isArray(x.pending)?x.pending.slice(0,5):[],
      sources:Array.isArray(x.sources)?x.sources.filter(s=>official(String(s?.url||""))).slice(0,6):[]
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
async function verifyWithGemini(sources,previous){
  if(!process.env.GEMINI_API_KEY)throw new Error("GEMINI_API_KEY missing");
  if(!sources.length)throw new Error("No direct official source pages were available");

  const prompt=`
You are the DAILY U.S. TARIFF VERIFICATION ENGINE for an apparel vendor.

TODAY: ${new Date().toISOString().slice(0,10)}
COPS: ${COPS.join(", ")}

Below are texts fetched DIRECTLY from official U.S. government websites.
You MUST use ONLY these supplied official texts.
The previous saved result is provided only as a comparison baseline; do not preserve it when newer official evidence changes it.

GOAL:
Determine CURRENT U.S. duty treatment specifically for QUALIFYING APPAREL. Reflect active FTA/preference duty-free treatment in the headline while separately adding any country-wide additional duties that still legally apply.

CRITICAL:
- This dashboard is APPAREL-SPECIFIC. For CAFTA-DR-originating apparel, treat the base duty as 0% when the supplied official evidence supports preferential treatment. For Haiti HOPE/HELP/CBTPA-eligible apparel, treat the base duty as 0% when current official evidence supports the program.
- Include only incremental/additional duties CURRENTLY effective today.
- Stack multiple current additional duties only when official evidence says both apply.
- Future rates or TRQs = PENDING, never included before effective date.
- For Bangladesh/Cambodia/Indonesia textile/apparel TRQs, keep PENDING until an official implementation/effective-date notice is found.
- CAFTA-DR and HOPE/HELP/CBTPA are base-duty preference programs. Reflect their 0% base duty in the apparel headline, BUT do not assume they exempt a separate Section 301 duty unless official evidence says so.
- Product/HTS-specific exceptions are CONDITIONAL and should not change a generalized apparel headline rate unless the official text supports doing so.
- The Feb. 24, 2026 Section 122 temporary 10% surcharge expired July 24, 2026 unless supplied newer official text explicitly shows an extension. Do not include an expired surcharge.
- Nicaragua's separate Section 301 rate is 0% during 2026 if the supplied official source confirms it; future 2027/2028 rates belong in pending.
- Haiti was not one of the listed 60 economies in the supplied Forced Labor Section 301 action. Do not assign that tariff to Haiti. Current 2026 official U.S. trade-preference evidence should be checked for HOPE/HELP/CBTPA; if active and the apparel qualifies, headline apparelEffectiveRate should be 0.
- If current Haiti HOPE/HELP or any separate additional-duty status cannot be established from supplied current official sources, use VERIFY instead of guessing.
- If evidence is insufficient/conflicting: status VERIFY, currentAdditionalRate null.
- Newer implementation/Federal Register notices override older announcements.

Return ONLY valid JSON:
{
 "countries":[
   {
    "country":"Vietnam",
    "apparelEffectiveRate":12.5,
    "currentAdditionalRate":12.5,
    "status":"CURRENT|PENDING|VERIFY",
    "currentLabelKr":"...",
    "currentLabelEn":"...",
    "components":[{"name":"...","rate":12.5,"status":"CURRENT|PENDING|EXEMPT|CONDITIONAL","effectiveDate":"YYYY-MM-DD or empty","noteKr":"...","noteEn":"..."}],
    "preference":{"program":"...","status":"ACTIVE|NONE|CONDITIONAL|VERIFY","noteKr":"...","noteEn":"..."},
    "trq":{"status":"ACTIVE|PENDING|NOT ELIGIBLE|NONE|VERIFY","effectiveDate":"YYYY-MM-DD or empty","noteKr":"...","noteEn":"..."},
    "pending":[{"name":"...","rate":10,"effectiveDate":"YYYY-MM-DD","noteKr":"...","noteEn":"..."}],
    "sources":[{"title":"official source title","url":"exact supplied official URL"}]
   }
 ]
}

Return all 9 countries.

PREVIOUS SAVED RESULT:
${JSON.stringify(previous||{})}

DIRECT OFFICIAL SOURCES:
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
  let parsed;
  try{parsed=JSON.parse(stripFence(extractText(j)));}catch{throw new Error("Gemini tariff JSON parsing failed");}
  return sanitize(parsed);
}

module.exports=async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});

  let saved=null,sha=null;
  try{const x=await readSaved();saved=x.data;sha=x.sha;}catch(e){console.error("[Tariff] saved read failed",e);}

  // 24h shared cache.
  if(saved&&saved.refreshStatus==="VERIFIED"&&ageMs(saved.asOf)<MAX_AGE_MS){
    res.setHeader("Cache-Control","s-maxage=3600, stale-while-revalidate=7200");
    return res.status(200).json({...saved,stale:false,servedFrom:"saved"});
  }

  try{
    const sources=await collectSources();
    const fresh=await verifyWithGemini(sources,saved);
    try{await saveSaved(fresh,sha);}catch(e){console.error("[Tariff] GitHub save failed",e);}
    res.setHeader("Cache-Control","s-maxage=3600, stale-while-revalidate=7200");
    return res.status(200).json({...fresh,servedFrom:"fresh",sourceCount:sources.length});
  }catch(e){
    console.error("[Tariff] refresh failed",e);
    if(saved){
      return res.status(200).json({
        ...saved,stale:true,refreshStatus:"STALE_FALLBACK",
        refreshError:e?.message||"Daily tariff refresh failed",servedFrom:"stale"
      });
    }
    return res.status(503).json({error:e?.message||"Tariff verification failed"});
  }
};
