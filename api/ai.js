// File: api/ai.js
// Daily Gemini insight with natural Korean + English apparel/retail terminology.

const MODEL=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";
const GEMINI_BASE="https://generativelanguage.googleapis.com/v1beta/models";
const FILE_PATH="ai-current.json";
const OWNER=process.env.GITHUB_OWNER||"supermegayoon";
const REPO=process.env.GITHUB_REPO||"Newsletter-for-Div-8";
const BRANCH=process.env.GITHUB_BRANCH||"main";

function kstDate(d=new Date()){
  return new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"
  }).format(d);
}
function savedDate(x){
  if(x?.generatedDateKST)return x.generatedDateKST;
  try{return x?.asOf?kstDate(new Date(x.asOf)):null}catch{return null}
}
function force(req){
  if(String(req.query?.force||"")!=="1")return false;
  if(!process.env.CRON_SECRET)return true;
  return req.headers.authorization===`Bearer ${process.env.CRON_SECRET}`;
}

async function gh(url,o={}){
  if(!process.env.GITHUB_TOKEN)throw Error("GITHUB_TOKEN missing");
  const r=await fetch(url,{
    ...o,
    headers:{
      Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,
      Accept:"application/vnd.github+json",
      "X-GitHub-Api-Version":"2022-11-28",
      ...(o.headers||{})
    }
  });
  const t=await r.text();
  let j={};try{j=t?JSON.parse(t):{}}catch{}
  if(!r.ok)throw Error(j?.message||`GitHub ${r.status}`);
  return j;
}

async function read(){
  const j=await gh(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`);
  return{
    data:JSON.parse(Buffer.from(String(j.content||"").replace(/\n/g,""),"base64").toString()),
    sha:j.sha
  };
}

async function save(o,sha){
  const b={
    message:`Daily AI ${o.generatedDateKST}`,
    content:Buffer.from(JSON.stringify(o,null,2)+"\n").toString("base64"),
    branch:BRANCH
  };
  if(sha)b.sha=sha;
  return gh(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`,{
    method:"PUT",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(b)
  });
}

function extract(d){
  return(d?.candidates?.[0]?.content?.parts||[])
    .map(p=>p?.text||"")
    .join("\n")
    .replace(/^```json\s*/i,"")
    .replace(/\s*```$/,"")
    .trim();
}


// Force common retail/apparel transliterations back to natural English.
// Applied AFTER Gemini generation so wording stays consistent even if Gemini ignores prompt examples.
const NATURAL_ENGLISH_REPLACEMENTS = [
  [/머신다이즈|머천다이즈/g, "merchandise"],
  [/홀리데이/g, "Holiday"],
  [/익스클루시브/g, "exclusive"],
  [/파트너십/g, "Partnership"],
  [/오프라인/g, "offline"],
  [/온라인/g, "online"],
  [/프로모션/g, "promotion"],
  [/콜라보레이션/g, "Collaboration"],
  [/리테일/g, "retail"],
  [/이커머스|이-커머스/g, "E-commerce"],
  [/마켓플레이스/g, "Marketplace"],
  [/액티브웨어/g, "activewear"],
  [/프라이빗 브랜드/g, "private brand"],
  [/홀세일/g, "wholesale"],
  [/셀스루|셀-스루/g, "sell-through"],
  [/리오더/g, "reorder"],
  [/리드타임/g, "lead time"],
  [/소싱/g, "sourcing"],
  [/인벤토리/g, "inventory"],
  [/마진/g, "margin"],
  [/프라이싱/g, "pricing"],
  [/카테고리/g, "category"],
  [/스토어/g, "store"],
  [/트래픽/g, "traffic"],
  [/가이던스/g, "guidance"],
  [/아웃룩/g, "outlook"],
  [/퍼레이드/g, "Parade"]
];

function naturalEnglishPostProcess(value) {
  if (typeof value === "string") {
    let s = value;
    for (const [pattern, replacement] of NATURAL_ENGLISH_REPLACEMENTS) {
      s = s.replace(pattern, replacement);
    }
    return s;
  }
  if (Array.isArray(value)) return value.map(naturalEnglishPostProcess);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = naturalEnglishPostProcess(v);
    return out;
  }
  return value;
}

async function generate(body){
  if(!process.env.GEMINI_API_KEY)throw Error("GEMINI_API_KEY missing");

  const prompt=`
You create TODAY'S issue of 8담당 DAILY MARKET BRIEF for a Korean apparel-vendor sales team.

KST ISSUE DATE: ${kstDate()}
GENERATION ID: ${Date.now()}

Use ONLY the supplied TODAY news and market snapshot.
Do not recycle yesterday's wording.
Even when the strategic direction is similar, rewrite headline and analysis around today's newest signals.

Main buyers:
Kohl's, A&F/Hollister, Macy's.

Be concrete, commercial, and useful to apparel sales/merchandising.

IMPORTANT KOREAN WRITING STYLE:
- Korean must remain the grammatical base, but KEEP common apparel/retail/business terms in natural English instead of mechanically transliterating them into Hangul.
- Preserve official Brand, Product, Campaign and Collection names in their original English spelling.
- Do NOT mechanically transliterate common industry terms when the English term itself is more natural.
- Examples:
  "Disney Holiday Capsule Collection" NOT "디즈니 홀리데이 캡슐 컬렉션"
  "Collaboration" NOT "콜라보레이션"
  "retail channel" NOT "리테일 채널"
- Naturally keep professional terms such as:
  Holiday season, IP, merchandise, sourcing, retail channel, margin, pricing,
  promotion, store, category, inventory, traffic, comp, guidance, outlook,
  E-commerce, Marketplace, Partnership, Expansion, activewear, denim,
  private brand, wholesale, sell-through, chase, reorder, FOB, lead time.

- STRICT transliteration rule: prefer the original English for these terms instead of Hangul:
  Holiday (not 홀리데이), exclusive (not 익스클루시브), merchandise (not 머신다이즈/머천다이즈),
  Parade (not 퍼레이드), offline store (not 오프라인 매장/오프라인 store),
  Collaboration (not 콜라보레이션), retail (not 리테일), promotion (not 프로모션),
  category (not 카테고리 when used as an industry label), activewear (not 액티브웨어),
  partnership (not 파트너십 when used as a business label).
- Prefer official English event names where known, e.g. "Thanksgiving Day Parade".
- Good example:
  "Macy's, 100주년 Parade 기념 exclusive Disney Capsule Collection 출시"
  "Macy's가 Thanksgiving Day Parade 100주년을 기념해 exclusive Disney Capsule Collection과 Holiday merchandise를 공개했습니다."

- Do NOT overuse English for ordinary concepts that sound more natural in Korean.
- The result should sound like a Korean apparel sales/merchandising manager speaking naturally in a business meeting.
- Keep sentences concise and executive-friendly.

Return ONLY JSON:
{
  "headline":{
    "kr":"today-specific Korean headline using natural English business terms where appropriate",
    "en":"today-specific English headline"
  },
  "summary":{
    "kr":"2-3 concise sentences",
    "en":"2-3 concise sentences"
  },
  "tags":["#tag1","#tag2","#tag3","#tag4"],
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
  "risk":{
    "level":"LOW|MEDIUM|HIGH",
    "kr":"...",
    "en":"..."
  },
  "actions":[
    {"owner":"Team 8","kr":"...","en":"..."},
    {"owner":"Team 8","kr":"...","en":"..."},
    {"owner":"Team 8","kr":"...","en":"..."}
  ]
}

MARKET:
${JSON.stringify(body.market||{})}

TODAY NEWS:
${JSON.stringify((body.news||[]).slice(0,20))}
`;

  const r=await fetch(`${GEMINI_BASE}/${encodeURIComponent(MODEL)}:generateContent`,{
    method:"POST",
    headers:{
      "x-goog-api-key":process.env.GEMINI_API_KEY,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      contents:[{role:"user",parts:[{text:prompt}]}],
      generationConfig:{
        temperature:0.7,
        maxOutputTokens:3200,
        responseMimeType:"application/json"
      }
    })
  });

  const j=await r.json();
  if(!r.ok)throw Error(j?.error?.message||`Gemini ${r.status}`);

  let insight;
  try{insight=naturalEnglishPostProcess(JSON.parse(extract(j)))}
  catch{throw Error("Gemini JSON parsing failed")}

  return{
    ok:true,
    asOf:new Date().toISOString(),
    generatedDateKST:kstDate(),
    schedule:"08:00 KST",
    refreshStatus:"VERIFIED",
    stale:false,
    provider:"Google Gemini",
    model:MODEL,
    insight
  };
}

module.exports=async(req,res)=>{
  let saved=null,sha=null;
  try{
    const x=await read();
    saved=x.data;
    sha=x.sha;
  }catch{}

  if(req.method==="GET"){
    return saved
      ? res.status(200).json({
          ...saved,
          generatedDateKST:savedDate(saved),
          stale:savedDate(saved)!==kstDate(),
          servedFrom:"saved"
        })
      : res.status(503).json({error:"No saved AI"});
  }

  if(req.method!=="POST"){
    return res.status(405).json({error:"Method not allowed"});
  }

  const f=force(req);

  if(String(req.query?.force||"")==="1"&&!f){
    return res.status(401).json({error:"Unauthorized"});
  }

  if(!f&&savedDate(saved)===kstDate()){
    return res.status(200).json({...saved,servedFrom:"saved"});
  }

  try{
    const fresh=await generate(req.body||{});
    try{
      await save(fresh,sha);
    }catch(e){
      fresh.saveWarning=e.message;
    }
    return res.status(200).json({...fresh,servedFrom:"fresh"});
  }catch(e){
    return saved
      ? res.status(200).json({
          ...saved,
          stale:true,
          refreshStatus:"STALE_FALLBACK",
          refreshError:e.message
        })
      : res.status(503).json({error:e.message});
  }
};
