// File: /api/news.js
// Fresh buyer + apparel industry news, up to 30 days.
// Priority: <=72h, then <=7d, then <=30d.
// No separate news API key required; uses existing GEMINI_API_KEY for curation.

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

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
    const source=sourceTag(b), pubDate=tag(b,"pubDate"), ah=ageHours(pubDate);
    return {
      searchKey:search.key, searchLabel:search.label,
      title:tag(b,"title"), description:tag(b,"description"),
      pubDate, ageHours:ah, link:linkTag(b),
      source:source.name||"Google News", sourceHome:source.url
    };
  }).filter(x=>x.title && x.pubDate && x.ageHours<=24*30+12);
}
function dedupe(items){
  const seen=new Set(),out=[];
  for(const x of items.sort((a,b)=>a.ageHours-b.ageHours)){
    const key=normalizeTitle(x.title); if(!key||seen.has(key))continue;
    seen.add(key);out.push(x);
  }
  return out;
}
function balancedPool(items){
  const by={};for(const x of items)(by[x.searchKey]||=[]).push(x);
  const out=[];
  for(const s of SEARCHES){
    const arr=(by[s.key]||[]).sort((a,b)=>a.ageHours-b.ageHours);
    const fresh=arr.filter(x=>x.ageHours<=72).slice(0,5);
    const week=arr.filter(x=>x.ageHours>72&&x.ageHours<=168).slice(0,4);
    const month=arr.filter(x=>x.ageHours>168).slice(0,3);
    out.push(...fresh,...week,...month);
  }
  return dedupe(out).slice(0,48);
}
function extractText(data){return(data?.candidates?.[0]?.content?.parts||[]).map(p=>p?.text||"").join("\n").trim();}
function stripFence(t){return String(t||"").replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();}

async function curate(raw){
  if(!process.env.GEMINI_API_KEY)return null;
  const prompt=`
You curate a daily retail/apparel news feed for an internal apparel-vendor sales team.

TODAY: ${new Date().toISOString()}
INPUT WINDOW: last 30 days maximum.

FRESHNESS PRIORITY:
1. <=72 hours: highest priority.
2. 4-7 days: second priority.
3. 8-30 days: use only when still strategically useful, when a buyer lacks fresher meaningful news, or when it provides context.
Never include anything older than 30 days.

DIVERSITY:
- Kohl's
- A&F / Hollister
- Macy's
- Ann Taylor
- Talbot's
- Pair of Thieves when meaningful
- Broader U.S. apparel/retail/product trend signals

CONTENT PRIORITY:
promotion, seasonal programs, category/product launches, collaborations, wholesale/channel moves, stores, earnings, consumer demand, inventory, pricing/value, kids, activewear, denim, private brands, competitive positioning.

RULES:
- Avoid duplicate syndicated stories.
- Do not force an old item if a buyer has no useful news.
- Do not invent facts.
- Buyer-specific news should outrank generic finance stories.
- Broader industry news is useful only when it can inform buyer/product strategy.
- Keep source URL exactly from input.

Return ONLY JSON array, maximum 20 items:
[
  {
    "brand":"kohls|af|macys|anntaylor|talbots|pairofthieves|industry|product",
    "brandLabel":"...",
    "category_kr":"프로모|상품|채널|실적|전략|트렌드|기타",
    "category_en":"Promo|Product|Channel|Earnings|Strategy|Trend|Other",
    "date":"YYYY.MM.DD",
    "title_kr":"한국어 제목",
    "title_en":"English title",
    "body_kr":"2문장 이내: 사실 요약 + 벤더 관점 의미",
    "body_en":"max 2 sentences: factual summary + vendor relevance",
    "source":"publisher",
    "sourceUrl":"input link exactly",
    "ageHours":number
  }
]

RAW ITEMS:
${JSON.stringify(raw)}
`.trim();

  const r=await fetch(`${GEMINI_BASE}/${encodeURIComponent(MODEL)}:generateContent`,{
    method:"POST",
    headers:{"x-goog-api-key":process.env.GEMINI_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({
      contents:[{role:"user",parts:[{text:prompt}]}],
      generationConfig:{maxOutputTokens:6500,responseMimeType:"application/json"}
    })
  });
  const j=await r.json();
  if(!r.ok)throw new Error(j?.error?.message||`Gemini ${r.status}`);
  return JSON.parse(stripFence(extractText(j)));
}
function fallback(raw){
  return raw.slice(0,20).map(x=>({
    brand:x.searchKey,brandLabel:x.searchLabel,category_kr:"뉴스",category_en:"News",
    date:new Date(x.pubDate).toISOString().slice(0,10).replace(/-/g,"."),
    title_kr:x.title,title_en:x.title,body_kr:x.description||"",body_en:x.description||"",
    source:x.source,sourceUrl:x.link,ageHours:Math.round(x.ageHours)
  }));
}

module.exports=async function handler(req,res){
  if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
  try{
    const settled=await Promise.allSettled(SEARCHES.map(fetchRss));
    const all=settled.flatMap(x=>x.status==="fulfilled"?x.value:[]);
    const pool=balancedPool(dedupe(all));
    let items;
    try{items=await curate(pool);}catch(e){console.error("Gemini news curation failed",e);items=fallback(pool);}
    const within72=items.filter(x=>Number(x.ageHours)<=72).length;
    const within7d=items.filter(x=>Number(x.ageHours)<=168).length;
    res.setHeader("Cache-Control","s-maxage=900, stale-while-revalidate=1800");
    return res.status(200).json({
      ok:true,updatedAt:new Date().toISOString(),
      freshness:{within72h:within72,within7d,total:items.length,windowDays:30},
      items
    });
  }catch(e){return res.status(500).json({error:e?.message||"News fetch failed"});}
};
