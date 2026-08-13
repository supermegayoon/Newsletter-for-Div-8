// File: /api/tariff.js
// Cached DAILY TARIFF WATCH
//
// Behavior:
// 1) Read last verified tariff-current.json from GitHub.
// 2) If verified within the last 24 hours, return it WITHOUT calling Gemini.
// 3) If stale, call Gemini + Google Search grounding ONCE, using only official U.S. sources.
// 4) On success, commit tariff-current.json to GitHub.
// 5) If Gemini quota/search fails, return the PREVIOUS saved result instead of breaking the page.
//
// Existing Vercel env vars used:
// GEMINI_API_KEY
// GEMINI_MODEL
// GITHUB_TOKEN
// Optional: GITHUB_OWNER / GITHUB_REPO / GITHUB_BRANCH

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const OWNER = process.env.GITHUB_OWNER || "supermegayoon";
const REPO = process.env.GITHUB_REPO || "Newsletter-for-Div-8";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const FILE_PATH = "tariff-current.json";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const COPS = [
  "Vietnam","Indonesia","Bangladesh","Cambodia",
  "Nicaragua","Guatemala","Costa Rica","El Salvador","Haiti"
];

function extractText(data){
  return (data?.candidates?.[0]?.content?.parts || [])
    .map(p=>p?.text || "").join("\n").trim();
}
function stripFence(t){
  return String(t||"")
    .replace(/^```json\s*/i,"")
    .replace(/^```\s*/i,"")
    .replace(/\s*```$/i,"")
    .trim();
}
function officialUrl(url=""){
  return /^https:\/\/([^/]+\.)?(ustr\.gov|whitehouse\.gov|cbp\.gov|federalregister\.gov|usitc\.gov|hts\.usitc\.gov)\//i.test(url);
}
function ageMs(asOf){
  const t = new Date(asOf || 0).getTime();
  return Number.isFinite(t) ? Date.now() - t : Number.MAX_SAFE_INTEGER;
}
async function gh(url, options={}){
  const r = await fetch(url,{
    ...options,
    headers:{
      "Authorization":`Bearer ${process.env.GITHUB_TOKEN}`,
      "Accept":"application/vnd.github+json",
      "X-GitHub-Api-Version":"2022-11-28",
      ...(options.headers || {})
    }
  });
  const text = await r.text();
  let j={}; try{j=text?JSON.parse(text):{};}catch{}
  if(!r.ok) throw new Error(j?.message || `GitHub ${r.status}`);
  return j;
}
async function readSaved(){
  if(!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN missing");
  const url=`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${encodeURIComponent(BRANCH)}`;
  const j=await gh(url);
  const content=Buffer.from(String(j.content||"").replace(/\n/g,""),"base64").toString("utf8");
  return {data:JSON.parse(content),sha:j.sha};
}
async function saveResult(obj, sha){
  const url=`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
  const content=Buffer.from(JSON.stringify(obj,null,2)+"\n","utf8").toString("base64");
  const body={
    message:`Daily tariff verification ${new Date().toISOString().slice(0,10)}`,
    content, branch:BRANCH, sha
  };
  return gh(url,{
    method:"PUT",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
}
function sanitizeResult(obj){
  const rows = Array.isArray(obj?.countries) ? obj.countries : [];
  const out = {
    ok:true,
    asOf:obj?.asOf || new Date().toISOString(),
    basis:"Additional U.S. import duties only; MFN/base HTS duty excluded",
    stale:false,
    refreshStatus:"VERIFIED",
    countries:rows.filter(x=>COPS.includes(x?.country)).map(x=>({
      country:x.country,
      currentAdditionalRate:Number.isFinite(Number(x.currentAdditionalRate))?Number(x.currentAdditionalRate):null,
      status:["CURRENT","PENDING","VERIFY"].includes(x.status)?x.status:"VERIFY",
      currentLabelKr:String(x.currentLabelKr||""),
      currentLabelEn:String(x.currentLabelEn||""),
      components:Array.isArray(x.components)?x.components.slice(0,6).map(c=>({
        name:String(c?.name||""),
        rate:Number.isFinite(Number(c?.rate))?Number(c.rate):null,
        status:["CURRENT","PENDING","EXEMPT","CONDITIONAL"].includes(c?.status)?c.status:"CURRENT",
        effectiveDate:String(c?.effectiveDate||""),
        noteKr:String(c?.noteKr||""),
        noteEn:String(c?.noteEn||"")
      })):[],
      preference:{
        program:String(x?.preference?.program||""),
        status:String(x?.preference?.status||""),
        noteKr:String(x?.preference?.noteKr||""),
        noteEn:String(x?.preference?.noteEn||"")
      },
      trq:{
        status:String(x?.trq?.status||""),
        effectiveDate:String(x?.trq?.effectiveDate||""),
        noteKr:String(x?.trq?.noteKr||""),
        noteEn:String(x?.trq?.noteEn||"")
      },
      pending:Array.isArray(x.pending)?x.pending.slice(0,5).map(p=>({
        name:String(p?.name||""),
        rate:Number.isFinite(Number(p?.rate))?Number(p.rate):null,
        effectiveDate:String(p?.effectiveDate||""),
        noteKr:String(p?.noteKr||""),
        noteEn:String(p?.noteEn||"")
      })):[],
      sources:Array.isArray(x.sources)
        ? x.sources.filter(s=>officialUrl(String(s?.url||""))).slice(0,6).map(s=>({
            title:String(s?.title||"Official source"),
            url:String(s?.url||"")
          }))
        :[]
    }))
  };
  for(const country of COPS){
    if(!out.countries.some(x=>x.country===country)){
      out.countries.push({
        country,currentAdditionalRate:null,status:"VERIFY",
        currentLabelKr:"공식 소스 확인 필요",
        currentLabelEn:"Official-source verification required",
        components:[],
        preference:{program:"",status:"VERIFY",noteKr:"",noteEn:""},
        trq:{status:"VERIFY",effectiveDate:"",noteKr:"",noteEn:""},
        pending:[],sources:[]
      });
    }
  }
  return out;
}

async function verifyWithGemini(){
  if(!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

  const today=new Date().toISOString().slice(0,10);
  const prompt=`
You are a U.S. TARIFF VERIFICATION ENGINE for an apparel vendor.

TODAY: ${today}

Verify CURRENT U.S. additional import duties for general textile/apparel imports from:
${COPS.join(", ")}

CRITICAL:
- EXCLUDE normal MFN/base HTS duty completely.
- currentAdditionalRate = only active incremental/additional duty above MFN/base HTS.
- Include currently active country-wide Section 301 / emergency / reciprocal / temporary additional duties when applicable to apparel/textiles.
- If active duties stack, sum them and list components.
- Do NOT include future announced duties before effective date.
- TRQ is ACTIVE only if an official implementation notice confirms it is operating.
- FTA/preference programs such as CAFTA-DR or HOPE/HELP belong under preference, not automatically inside currentAdditionalRate.
- Product-specific or HTS-specific duties that cannot be generalized across apparel should be CONDITIONAL and not added to the headline rate.
- If current implementation cannot be verified, use VERIFY and null rate rather than guessing.

VERIFY THESE ISSUES, DO NOT ASSUME:
- July 23, 2026 forced-labor Section 301 final action and country rates/exemptions.
- Bangladesh/Cambodia/Indonesia/Malaysia textile/apparel TRQ implementation status.
- Vietnam current treatment.
- CAFTA-DR treatment for Nicaragua/Guatemala/Costa Rica/El Salvador.
- Nicaragua separate Section 301 action and stacking.
- Haiti HOPE/HELP current status/expiration.
- Any current temporary/reciprocal tariff that stacks or provides an exemption.

SOURCE RULE:
Use Google Search grounding but use ONLY these official U.S. government sources in the final determination:
ustr.gov
whitehouse.gov
federalregister.gov
cbp.gov
usitc.gov
hts.usitc.gov

Newest implementation notice overrides older announcement/ruling.

Return ONLY valid JSON:
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
        {
          "name":"...",
          "rate":12.5,
          "status":"CURRENT|PENDING|EXEMPT|CONDITIONAL",
          "effectiveDate":"YYYY-MM-DD or empty",
          "noteKr":"...",
          "noteEn":"..."
        }
      ],
      "preference":{
        "program":"...",
        "status":"ACTIVE|NONE|CONDITIONAL|VERIFY",
        "noteKr":"...",
        "noteEn":"..."
      },
      "trq":{
        "status":"ACTIVE|PENDING|NOT ELIGIBLE|NONE|VERIFY",
        "effectiveDate":"YYYY-MM-DD or empty",
        "noteKr":"...",
        "noteEn":"..."
      },
      "pending":[
        {
          "name":"...",
          "rate":10,
          "effectiveDate":"YYYY-MM-DD",
          "noteKr":"현재 세율에는 미포함",
          "noteEn":"Not included in current rate"
        }
      ],
      "sources":[
        {"title":"official document","url":"https://...official.gov/..."}
      ]
    }
  ]
}

Return all 9 countries.
`.trim();

  const r=await fetch(`${GEMINI_BASE}/${encodeURIComponent(MODEL)}:generateContent`,{
    method:"POST",
    headers:{
      "x-goog-api-key":process.env.GEMINI_API_KEY,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      contents:[{role:"user",parts:[{text:prompt}]}],
      tools:[{google_search:{}}],
      generationConfig:{maxOutputTokens:7000}
    })
  });
  const j=await r.json();
  if(!r.ok) throw new Error(j?.error?.message || `Gemini ${r.status}`);
  let parsed;
  try{parsed=JSON.parse(stripFence(extractText(j)));}catch{throw new Error("Gemini returned non-JSON tariff data");}
  return sanitizeResult(parsed);
}

module.exports=async function handler(req,res){
  if(req.method!=="GET") return res.status(405).json({error:"Method not allowed"});

  let saved=null, sha=null;
  try{
    const x=await readSaved(); saved=x.data; sha=x.sha;
  }catch(e){
    console.error("[Tariff] saved file read failed",e);
  }

  // Fast path: verified within 24h. Zero Gemini call.
  if(saved && saved.asOf && ageMs(saved.asOf) < MAX_AGE_MS && saved.refreshStatus==="VERIFIED"){
    res.setHeader("Cache-Control","s-maxage=3600, stale-while-revalidate=7200");
    return res.status(200).json({...saved,stale:false,servedFrom:"saved"});
  }

  // Stale: try one fresh verification.
  try{
    const fresh=await verifyWithGemini();

    // Persist; if commit races, still return fresh result.
    try{
      if(sha) await saveResult(fresh,sha);
    }catch(e){
      console.error("[Tariff] GitHub save failed",e);
    }

    res.setHeader("Cache-Control","s-maxage=3600, stale-while-revalidate=7200");
    return res.status(200).json({...fresh,servedFrom:"fresh"});
  }catch(e){
    console.error("[Tariff] fresh verification failed",e);

    // Quota/search outage safety: NEVER blank the dashboard if we have previous data.
    if(saved){
      return res.status(200).json({
        ...saved,
        ok:true,
        stale:true,
        refreshStatus:"STALE_FALLBACK",
        refreshError:e?.message || "Daily verification failed",
        servedFrom:"stale"
      });
    }

    return res.status(503).json({
      error:e?.message || "Tariff verification failed and no saved result exists."
    });
  }
};
