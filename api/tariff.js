// File: /api/tariff.js
// DAILY TARIFF WATCH — apparel/textile COPs
// Uses Gemini + Google Search grounding and ONLY official U.S. government sources.
// MFN/base HTS duty is EXCLUDED from the displayed additional-duty rate.

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const COPS = [
  "Vietnam",
  "Indonesia",
  "Bangladesh",
  "Cambodia",
  "Nicaragua",
  "Guatemala",
  "Costa Rica",
  "El Salvador",
  "Haiti"
];

function extractText(data){
  return (data?.candidates?.[0]?.content?.parts || [])
    .map(p => p?.text || "")
    .join("\n")
    .trim();
}
function stripFence(t){
  return String(t || "")
    .replace(/^```json\s*/i,"")
    .replace(/^```\s*/i,"")
    .replace(/\s*```$/i,"")
    .trim();
}
function officialUrl(url=""){
  return /^https:\/\/([^/]+\.)?(ustr\.gov|whitehouse\.gov|cbp\.gov|federalregister\.gov|usitc\.gov|hts\.usitc\.gov)\//i.test(url);
}
function sanitizeResult(obj){
  const countries = Array.isArray(obj?.countries) ? obj.countries : [];
  return {
    asOf: obj?.asOf || new Date().toISOString(),
    basis: "Additional U.S. import duties only; MFN/base HTS duty excluded",
    countries: countries
      .filter(x => COPS.includes(x?.country))
      .map(x => ({
        country: x.country,
        currentAdditionalRate:
          Number.isFinite(Number(x.currentAdditionalRate))
            ? Number(x.currentAdditionalRate)
            : null,
        status: ["CURRENT","PENDING","VERIFY"].includes(x.status) ? x.status : "VERIFY",
        currentLabelKr: String(x.currentLabelKr || ""),
        currentLabelEn: String(x.currentLabelEn || ""),
        components: Array.isArray(x.components) ? x.components.slice(0,5).map(c=>({
          name: String(c?.name || ""),
          rate: Number.isFinite(Number(c?.rate)) ? Number(c.rate) : null,
          status: ["CURRENT","PENDING","EXEMPT","CONDITIONAL"].includes(c?.status) ? c.status : "CURRENT",
          effectiveDate: String(c?.effectiveDate || ""),
          noteKr: String(c?.noteKr || ""),
          noteEn: String(c?.noteEn || "")
        })) : [],
        preference: {
          program: String(x?.preference?.program || ""),
          status: String(x?.preference?.status || ""),
          noteKr: String(x?.preference?.noteKr || ""),
          noteEn: String(x?.preference?.noteEn || "")
        },
        trq: {
          status: String(x?.trq?.status || ""),
          effectiveDate: String(x?.trq?.effectiveDate || ""),
          noteKr: String(x?.trq?.noteKr || ""),
          noteEn: String(x?.trq?.noteEn || "")
        },
        pending: Array.isArray(x.pending) ? x.pending.slice(0,4).map(p=>({
          name:String(p?.name||""),
          rate:Number.isFinite(Number(p?.rate))?Number(p.rate):null,
          effectiveDate:String(p?.effectiveDate||""),
          noteKr:String(p?.noteKr||""),
          noteEn:String(p?.noteEn||"")
        })) : [],
        sources: Array.isArray(x.sources)
          ? x.sources.filter(s=>officialUrl(String(s?.url||""))).slice(0,5).map(s=>({
              title:String(s?.title||"Official source"),
              url:String(s?.url||"")
            }))
          : []
      }))
  };
}

module.exports = async function handler(req,res){
  if(req.method !== "GET") return res.status(405).json({error:"Method not allowed"});
  if(!process.env.GEMINI_API_KEY){
    return res.status(500).json({error:"GEMINI_API_KEY is not configured."});
  }

  const today = new Date().toISOString().slice(0,10);

  const prompt = `
You are a DAILY U.S. TARIFF VERIFICATION ENGINE for an apparel vendor.

TODAY: ${today}

TASK:
For each of these apparel sourcing countries:
${COPS.join(", ")}

determine the U.S. import duties that are CURRENTLY EFFECTIVE TODAY for general textile/apparel imports.

CRITICAL DEFINITION:
- EXCLUDE the normal MFN/base HTS duty completely.
- "currentAdditionalRate" must represent ONLY active incremental/additional U.S. duties above MFN/base HTS.
- Include active Section 301, reciprocal/emergency/temporary import duties, or other country-wide additional duties if they currently apply to apparel/textiles.
- If multiple active additional duties stack, SUM them for currentAdditionalRate and list each in components.
- Do NOT include a future announced duty in currentAdditionalRate before its effective date.
- Do NOT assume an announced TRQ is effective until an official notice establishes its effective date and operation.
- Treat FTA/preference programs (CAFTA-DR, HOPE/HELP, etc.) separately under "preference"; do not confuse preferential base-duty treatment with an exemption from an additional tariff unless an official source explicitly says so.
- If treatment depends on origin qualification, U.S. inputs, quota, product exclusion, or Chapter 99 classification, state that clearly.
- If an additional duty is product-specific and cannot be generalized across apparel, do NOT add it to the headline rate; describe it as conditional.
- If official sources conflict or current implementation cannot be verified, status must be VERIFY and currentAdditionalRate must be null rather than guessing.

SOURCE RULE:
Use Google Search, but rely ONLY on current official U.S. government sources:
1) ustr.gov
2) whitehouse.gov
3) federalregister.gov
4) cbp.gov
5) usitc.gov / hts.usitc.gov

Do NOT use law firms, blogs, news media, consultants, Wikipedia, or secondary summaries in the final determination.

FRESHNESS:
Search for changes, implementation notices, Federal Register notices, Chapter 99 updates, TRQ notices, suspension/extension notices, and effective dates through TODAY.
Give precedence to the newest official implementation document over older rulings or announcements.

IMPORTANT CURRENT ISSUES TO VERIFY, NOT ASSUME:
- July 23, 2026 forced-labor Section 301 final action (10% / 12.5%, exemptions)
- Bangladesh/Cambodia/Indonesia/Malaysia textile/apparel TRQ implementation status and effective date
- Vietnam treatment under that action
- CAFTA-DR treatment for Nicaragua/Guatemala/Costa Rica/El Salvador
- Nicaragua's separate Section 301 action and any stacking
- Haiti HOPE/HELP current status/expiration
- Any temporary or reciprocal tariff that currently stacks or exempts qualifying apparel/textiles

Return ONLY valid JSON:
{
  "asOf":"ISO date/time",
  "countries":[
    {
      "country":"Vietnam",
      "currentAdditionalRate":12.5,
      "status":"CURRENT|PENDING|VERIFY",
      "currentLabelKr":"MFN 제외 현재 추가관세를 짧게 설명",
      "currentLabelEn":"short English description",
      "components":[
        {
          "name":"Section 301 ...",
          "rate":12.5,
          "status":"CURRENT|PENDING|EXEMPT|CONDITIONAL",
          "effectiveDate":"YYYY-MM-DD or empty",
          "noteKr":"...",
          "noteEn":"..."
        }
      ],
      "preference":{
        "program":"CAFTA-DR / HOPE-HELP / None / etc.",
        "status":"ACTIVE / NONE / CONDITIONAL / VERIFY",
        "noteKr":"...",
        "noteEn":"..."
      },
      "trq":{
        "status":"ACTIVE / PENDING / NOT ELIGIBLE / NONE / VERIFY",
        "effectiveDate":"YYYY-MM-DD or empty",
        "noteKr":"...",
        "noteEn":"..."
      },
      "pending":[
        {
          "name":"future change",
          "rate":10,
          "effectiveDate":"YYYY-MM-DD",
          "noteKr":"현재 세율에는 미포함",
          "noteEn":"Not included in current rate"
        }
      ],
      "sources":[
        {"title":"official document title","url":"https://...official.gov/..."}
      ]
    }
  ]
}

Do this for all 9 countries. Do not omit a country.
`.trim();

  try{
    const response = await fetch(`${API_BASE}/${encodeURIComponent(MODEL)}:generateContent`,{
      method:"POST",
      headers:{
        "x-goog-api-key":process.env.GEMINI_API_KEY,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        contents:[{role:"user",parts:[{text:prompt}]}],
        tools:[{google_search:{}}],
        generationConfig:{
          maxOutputTokens:7000
        }
      })
    });

    const data = await response.json();
    if(!response.ok){
      return res.status(response.status).json({
        error:data?.error?.message || `Gemini tariff verification returned ${response.status}`
      });
    }

    let parsed;
    try{
      parsed = JSON.parse(stripFence(extractText(data)));
    }catch{
      return res.status(502).json({
        error:"Tariff verifier returned non-JSON output.",
        raw:extractText(data).slice(0,1200)
      });
    }

    const clean = sanitizeResult(parsed);

    // Require all 9 COPs. Missing rows are explicit VERIFY rows.
    for(const country of COPS){
      if(!clean.countries.some(x=>x.country===country)){
        clean.countries.push({
          country,
          currentAdditionalRate:null,
          status:"VERIFY",
          currentLabelKr:"공식 소스 확인 필요",
          currentLabelEn:"Official-source verification required",
          components:[],
          preference:{program:"",status:"VERIFY",noteKr:"",noteEn:""},
          trq:{status:"VERIFY",effectiveDate:"",noteKr:"",noteEn:""},
          pending:[],
          sources:[]
        });
      }
    }

    res.setHeader("Cache-Control","s-maxage=21600, stale-while-revalidate=43200");
    return res.status(200).json({ok:true,...clean});
  }catch(e){
    console.error("[Tariff Watch]",e);
    return res.status(500).json({error:e?.message || "Tariff watch failed"});
  }
};
