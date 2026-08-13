// File: /api/ai.js
// Bilingual Buyer Strategy AI.
// Returns Korean + English together, so language toggle updates instantly without another API call.

const MODEL=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";
const API_BASE="https://generativelanguage.googleapis.com/v1beta/models";

function clean(v,max=1600){return String(v??"").replace(/\s+/g," ").trim().slice(0,max);}
function normalizeNews(news){
  if(!Array.isArray(news))return[];
  return news.slice(0,20).map(n=>({
    brand:clean(n.brandLabel||n.brand,80),date:clean(n.date,30),
    title_kr:clean(n.title_kr,260),title_en:clean(n.title_en,260),
    body_kr:clean(n.body_kr,700),body_en:clean(n.body_en,700),source:clean(n.source,100),
    ageHours:Number.isFinite(Number(n.ageHours))?Number(n.ageHours):null
  }));
}
function normalizeMarket(m){
  if(!m||typeof m!=="object")return{};
  const allowed=["KSS","ANF","M","KRW=X","CTZ26.NYB","CL=F","BZ=F"],out={};
  for(const s of allowed){const d=m[s];if(!d)continue;out[s]={price:Number(d.price)||null,changePct:Number.isFinite(Number(d.changePct))?Number(d.changePct):null};}
  return out;
}
function extract(d){return(d?.candidates?.[0]?.content?.parts||[]).map(p=>p?.text||"").join("\n").trim();}
function strip(t){return String(t||"").replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();}

module.exports=async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
  if(!process.env.GEMINI_API_KEY)return res.status(500).json({error:"GEMINI_API_KEY is not configured."});

  const b=req.body||{},news=normalizeNews(b.news),market=normalizeMarket(b.market);
  const prompt=`
You are the strategy analyst for "8담당 DAILY MARKET BRIEF", an internal apparel-vendor sales newsletter.

PRIMARY GOAL:
Turn current buyer/retailer news into practical apparel-vendor sales actions.
Buyer strategy is the priority. Raw materials/FX/oil are secondary signals only when materially relevant.

Main buyers: Kohl's, A&F / Hollister, Macy's.
Other retailers/brands can appear if supplied news is strategically useful.

Think: NEWS SIGNAL -> COMMERCIAL IMPLICATION -> SPECIFIC VENDOR ACTION.

RULES:
- Analyze ONLY supplied data.
- Do not invent buyer plans, orders, inventory, category sales, guidance, tariffs, or demand facts.
- Stock prices are supporting sentiment only.
- Prefer specific actions: propose, prepare, connect, validate, follow up, prioritize, test.
- Avoid generic "monitor the market."
- If a buyer has no meaningful recent signal, say so.
- Actions should be executable today by sales/merchandising.
- Raw materials should not dominate.

Return ONLY valid JSON exactly in this bilingual schema:
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

Return 3 actions normally, max 4.
Korean should be concise business Korean.
English should be natural management-friendly business English, not literal Korean translation.

Headline KR: ${clean(b.headline,300)}
Summary KR: ${clean(b.summary,1800)}
Market: ${JSON.stringify(market)}
News: ${JSON.stringify(news)}
`.trim();

  try{
    const r=await fetch(`${API_BASE}/${encodeURIComponent(MODEL)}:generateContent`,{
      method:"POST",
      headers:{"x-goog-api-key":process.env.GEMINI_API_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({
        contents:[{role:"user",parts:[{text:prompt}]}],
        generationConfig:{maxOutputTokens:2600,responseMimeType:"application/json"}
      })
    });
    const j=await r.json();
    if(!r.ok)return res.status(r.status).json({error:j?.error?.message||`Gemini ${r.status}`});
    let insight;try{insight=JSON.parse(strip(extract(j)));}catch{return res.status(502).json({error:"Gemini JSON parsing failed."});}
    res.setHeader("Cache-Control","no-store");
    return res.status(200).json({ok:true,provider:"Google Gemini",model:MODEL,updatedAt:new Date().toISOString(),insight});
  }catch(e){return res.status(500).json({error:e?.message||"Gemini analysis failed."});}
};
