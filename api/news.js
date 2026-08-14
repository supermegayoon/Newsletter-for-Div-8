// File: /api/news.js
// Shared KST 08:00 news snapshot.
// Normal GET only reads news-current.json.
// Only the daily cron calls ?force=1 and invokes Gemini.

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const FILE_PATH = "news-current.json";

const OWNER = process.env.GITHUB_OWNER || "supermegayoon";
const REPO = process.env.GITHUB_REPO || "Newsletter-for-Div-8";
const BRANCH = process.env.GITHUB_BRANCH || "main";

function kstDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
}

function forceAllowed(req) {
  if (String(req.query?.force || "") !== "1") return false;
  if (!process.env.CRON_SECRET) return true;
  return req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
}

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

const SEARCHES = [
  { key:"kohls", label:"Kohl's", q:'Kohl\'s apparel OR fashion OR promotion OR back-to-school OR kids OR activewear OR private label OR earnings OR stores' },
  { key:"af", label:"A&F / Hollister", q:'Abercrombie Fitch Hollister apparel OR promotion OR wholesale OR Target OR kids OR activewear OR denim OR earnings' },
  { key:"macys", label:"Macy's", q:'Macy\'s apparel OR fashion OR promotion OR inventory OR Bloomingdale\'s OR private brand OR earnings OR stores' },
  { key:"anntaylor", label:"Ann Taylor", q:'Ann Taylor apparel fashion KnitWell product promotion store' },
  { key:"talbots", label:"Talbot's", q:'Talbots apparel fashion KnitWell product promotion store' },
  { key:"pairofthieves", label:"Pair of Thieves", q:'Pair of Thieves apparel underwear socks retail Target Walmart' },
  { key:"industry", label:"Industry", q:'US apparel retail trends promotions consumer demand fashion retail back-to-school holiday department stores apparel sales' },
  { key:"product", label:"Product Trend", q:'US fashion trend activewear denim kids apparel women mens retail trend product launches' }
];

function decodeXml(s=""){
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1")
    .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/&lt;/g,"<").replace(/&gt;/g,">");
}
function stripTags(s=""){ return decodeXml(s).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim(); }
function tag(block,name){
  const m=block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,"i"));
  return m ? stripTags(m[1]) : "";
}
function sourceTag(block){
  const m=block.match(/<source(?:\s+url="([^"]*)")?>([\s\S]*?)<\/source>/i);
  return m ? {url:decodeXml(m[1]||""),name:stripTags(m[2]||"")} : {url:"",name:""};
}
function linkTag(block){
  const m=block.match(/<link>([\s\S]*?)<\/link>/i);
  return m ? decodeXml(m[1]).trim() : "";
}
function normalizeTitle(t=""){
  return t.toLowerCase().replace(/\s+-\s+[^-]{2,45}$/,"")
    .replace(/[^a-z0-9가-힣]+/g," ").trim();
}
function ageHours(date){
  const ms=Date.now()-new Date(date).getTime();
  return Number.isFinite(ms)?ms/36e5:99999;
}
async function fetchRss(search){
  const q=`${search.q} when:30d`;
  const url=`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
  const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0"}});
  if(!r.ok)throw new Error(`Google News RSS ${r.status}`);
  const xml=await r.text();
  const blocks=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);
  return blocks.map(b=>{
    const source=sourceTag(b),pubDate=tag(b,"pubDate"),ah=ageHours(pubDate);
    return {
      searchKey:search.key,searchLabel:search.label,title:tag(b,"title"),
      description:tag(b,"description"),pubDate,ageHours:ah,link:linkTag(b),
      source:source.name||"Google News"
    };
  }).filter(x=>x.title&&x.pubDate&&x.ageHours<=24*30+12);
}
function dedupe(items){
  const seen=new Set(),out=[];
  for(const x of items.sort((a,b)=>a.ageHours-b.ageHours)){
    const key=normalizeTitle(x.title);if(!key||seen.has(key))continue;
    seen.add(key);out.push(x);
  }
  return out;
}
function pool(items){
  const by={};for(const x of items)(by[x.searchKey]||=[]).push(x);
  const out=[];
  for(const s of SEARCHES){
    const arr=(by[s.key]||[]).sort((a,b)=>a.ageHours-b.ageHours);
    out.push(
      ...arr.filter(x=>x.ageHours<=72).slice(0,5),
      ...arr.filter(x=>x.ageHours>72&&x.ageHours<=168).slice(0,4),
      ...arr.filter(x=>x.ageHours>168).slice(0,3)
    );
  }
  return dedupe(out).slice(0,48);
}
function extractText(d){return(d?.candidates?.[0]?.content?.parts||[]).map(p=>p?.text||"").join("\n").trim();}
function stripFence(t){return String(t||"").replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();}

async function curate(raw){
  if(!process.env.GEMINI_API_KEY)throw new Error("GEMINI_API_KEY missing");

  const prompt=`
You curate a daily retail/apparel news feed for a Korean apparel-vendor sales team.

TODAY: ${new Date().toISOString()}
INPUT WINDOW: maximum 30 days.

Priority:
1) <=72h
2) 4-7d
3) 8-30d only when strategically useful or fresher meaningful news is unavailable.

Cover:
Kohl's, A&F/Hollister, Macy's, Ann Taylor, Talbot's, Pair of Thieves,
plus actionable U.S. apparel/retail/product trend signals.

Prioritize:
promotion, seasonal programs, category/product launches, Collaboration, wholesale/channel,
stores, earnings, consumer demand, inventory, pricing/value, kids, activewear, denim,
private brands, competitive positioning.

IMPORTANT KOREAN WRITING STYLE:
- Korean must remain the grammatical base, but KEEP common apparel/retail/business terms in natural English instead of mechanically transliterating them into Hangul.
- Preserve official Brand, Product, Campaign and Collection names in their original English spelling.
- Do NOT mechanically transliterate a common industry English term when the English itself is more natural.
- Examples:
  "Disney Holiday Capsule Collection" NOT "디즈니 홀리데이 캡슐 컬렉션"
  "Collaboration" NOT "콜라보레이션"
  "retail channel" NOT "리테일 채널"
- Naturally keep professional terms such as:
  Holiday season, IP, merchandise, sourcing, retail channel, margin, pricing,
  promotion, store, category, inventory, traffic, comp, guidance, outlook,
  E-commerce, Marketplace, Partnership, Expansion, activewear, denim,
  private brand, wholesale, sell-through, chase, reorder, FOB, lead time.
- Do NOT overuse English for ordinary concepts that sound more natural in Korean.
- The Korean output should sound like a Korean apparel sales/merchandising manager speaking naturally in a business meeting.
- Keep sentences concise and easy to scan.

Avoid duplicate syndicated stories. Do not invent facts.

Return ONLY JSON array, max 20:
[
  {
    "brand":"...",
    "brandLabel":"...",
    "category_kr":"short natural Korean/English business label",
    "category_en":"...",
    "date":"YYYY.MM.DD",
    "title_kr":"natural Korean sentence with English industry terminology where appropriate",
    "title_en":"...",
    "body_kr":"max 2 sentences: factual summary + vendor relevance, using natural Korean + English industry terms",
    "body_en":"max 2 sentences: fact + vendor relevance",
    "source":"publisher",
    "sourceUrl":"input link exactly",
    "ageHours":number
  }
]

RAW:
${JSON.stringify(raw)}
`.trim();

  const r=await fetch(`${GEMINI_BASE}/${encodeURIComponent(MODEL)}:generateContent`,{
    method:"POST",
    headers:{"x-goog-api-key":process.env.GEMINI_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({
      contents:[{role:"user",parts:[{text:prompt}]}],
      generationConfig:{
        temperature:0.35,
        maxOutputTokens:6500,
        responseMimeType:"application/json"
      }
    })
  });

  const j=await r.json();
  if(!r.ok)throw new Error(j?.error?.message||`Gemini ${r.status}`);
  return JSON.parse(stripFence(extractText(j)));
}

async function buildFresh(){
  const settled=await Promise.allSettled(SEARCHES.map(fetchRss));
  const all=settled.flatMap(x=>x.status==="fulfilled"?x.value:[]);
  const raw=pool(dedupe(all));
  const items=await curate(raw);

  return {
    ok:true,
    asOf:new Date().toISOString(),
    generatedDateKST:kstDate(),
    schedule:"08:00 KST",
    refreshStatus:"VERIFIED",
    stale:false,
    freshness:{
      within72h:items.filter(x=>Number(x.ageHours)<=72).length,
      within7d:items.filter(x=>Number(x.ageHours)<=168).length,
      total:items.length,
      windowDays:30
    },
    items
  };
}

module.exports=async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
  res.setHeader("Cache-Control","no-store");

  let saved=null,sha=null;
  try{const x=await readGithubJson(FILE_PATH);saved=x.data;sha=x.sha;}
  catch(e){console.error("[News cache] read failed",e);}

  const force=forceAllowed(req);

  if(!force && saved){
    return res.status(200).json({...saved,servedFrom:"saved"});
  }

  if(String(req.query?.force||"")==="1" && !force){
    return res.status(401).json({error:"Unauthorized forced refresh"});
  }

  if(!force && !saved){
    return res.status(503).json({error:"No saved news exists yet. Run /api/daily-update once."});
  }

  try{
    const fresh=await buildFresh();
    try{
      await saveGithubJson(FILE_PATH,fresh,sha,`Daily news refresh ${fresh.generatedDateKST} KST`);
    }catch(e){
      console.error("[News cache] save failed",e);
      fresh.saveWarning=e.message;
    }
    return res.status(200).json({...fresh,servedFrom:"fresh"});
  }catch(e){
    console.error("[News cache] refresh failed",e);
    if(saved){
      return res.status(200).json({
        ...saved,
        stale:true,
        refreshStatus:"STALE_FALLBACK",
        refreshError:e.message,
        servedFrom:"stale"
      });
    }
    return res.status(503).json({error:e?.message||"News refresh failed"});
  }
};
