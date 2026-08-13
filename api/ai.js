// File: /api/ai.js
// Buyer-strategy focused Gemini analysis for 8담당 DAILY MARKET BRIEF.
// Keeps raw material dashboard separate and uses materials only when they materially affect buyer strategy.

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function cleanText(value, max = 1500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeNews(news) {
  if (!Array.isArray(news)) return [];
  return news.slice(0, 16).map(n => ({
    brand: cleanText(n.brandLabel || n.brand, 80),
    date: cleanText(n.date, 30),
    title: cleanText(n.title_kr || n.title_en, 260),
    body: cleanText(n.body_kr || n.body_en, 700),
    source: cleanText(n.source, 100)
  }));
}

function normalizeMarket(market) {
  if (!market || typeof market !== "object") return {};
  const allowed = ["KSS", "ANF", "M", "KRW=X", "CTZ26.NYB", "CL=F", "BZ=F"];
  const out = {};

  for (const symbol of allowed) {
    const d = market[symbol];
    if (!d || typeof d !== "object") continue;
    out[symbol] = {
      price: Number.isFinite(Number(d.price)) ? Number(d.price) : null,
      changePct: Number.isFinite(Number(d.changePct)) ? Number(d.changePct) : null
    };
  }
  return out;
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map(p => p?.text || "").join("\n").trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is not configured in Vercel Environment Variables."
    });
  }

  const body = req.body || {};
  const news = normalizeNews(body.news);
  const market = normalizeMarket(body.market);
  const headline = cleanText(body.headline, 300);
  const summary = cleanText(body.summary, 1800);

  if (!news.length && !Object.keys(market).length) {
    return res.status(400).json({ error: "No newsletter data supplied." });
  }

  const prompt = `
You are the strategy analyst for "8담당 DAILY MARKET BRIEF", an internal apparel-vendor sales newsletter.

PRIMARY GOAL:
Turn current buyer/retailer news into practical sales actions for the vendor team.
Do NOT make raw materials the center of the analysis. Raw materials, FX, and oil should be mentioned only when they materially affect pricing, margin, sourcing, or buyer strategy.

AUDIENCE:
- Apparel sales, merchandising, sourcing, costing, product-development and management teams.
- Main buyer relevance: Kohl's, A&F/Hollister, Macy's.
- Other retailers/brands such as Target, Walmart, Gap, etc. can be included only when the supplied news makes them strategically relevant.

HOW TO THINK:
For each buyer or relevant retailer, identify:
1) What changed?
2) Why does it matter to an apparel vendor?
3) What concrete sales/product/category action should the team consider?
4) Is there a near-term opportunity, risk, or follow-up?

PRIORITY ORDER:
1. Buyer strategy / sales opportunity
2. Product & category opportunity
3. Promotion / seasonal timing / consumer demand
4. Chase / reorder / quick-response opportunity
5. Competitive positioning and whitespace
6. Margin / raw material / FX only when relevant

IMPORTANT:
- Analyze ONLY the supplied information.
- Do not invent buyer plans, category sales, inventory levels, orders, earnings guidance, tariffs, or facts not present in the supplied data.
- Separate observed facts from inference.
- Stock-price moves are supporting sentiment only, never direct proof of buyer demand.
- Avoid generic advice like "monitor the market" unless tied to a specific supplied signal.
- Give vendor-side actions that are specific enough to be useful in a sales meeting.
- If there is not enough evidence for a buyer, say "현재 뉴스 기준 뚜렷한 액션 신호 없음" rather than inventing a strategy.
- Keep total output concise and practical.

RETURN EXACTLY THIS STRUCTURE:

[오늘의 AI 한줄]
<1 sentence focused on the most important commercial takeaway>

[Buyer별 Action Insight]
• Kohl's — <news → implication → vendor action>
• A&F / Hollister — <news → implication → vendor action>
• Macy's — <news → implication → vendor action>
• Other — <only if another retailer/brand is materially relevant; otherwise omit this line>

[8담당 영업 기회]
• <specific product/category/seasonal opportunity 1>
• <specific commercial opportunity 2>
• <specific sales preparation or follow-up 3>

[오늘 체크할 것]
1. <specific buyer/product action>
2. <specific buyer/product action>
3. <specific risk or follow-up>

[리스크 레벨]
<LOW / MEDIUM / HIGH> — <short commercial reason>

STYLE:
- Korean
- Concise, management-friendly
- Action-oriented
- Prefer "제안/준비/확인/선점/연결/검토" style verbs
- Avoid over-focusing on raw materials
- Keep the full response under about 900 Korean characters

Current newsletter headline:
${headline || "(none)"}

Current newsletter summary:
${summary || "(none)"}

Market data:
${JSON.stringify(market)}

News items:
${JSON.stringify(news)}
`.trim();

  try {
    const url = `${API_BASE}/${encodeURIComponent(MODEL)}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": process.env.GEMINI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 1000
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", response.status, data);
      return res.status(response.status).json({
        error: data?.error?.message || `Gemini API returned ${response.status}`
      });
    }

    const text = extractText(data);

    if (!text) {
      return res.status(502).json({ error: "Gemini returned no text." });
    }

    res.setHeader("Cache-Control", "no-store");

    return res.status(200).json({
      ok: true,
      provider: "Google Gemini",
      model: MODEL,
      updatedAt: new Date().toISOString(),
      text
    });
  } catch (error) {
    console.error("Gemini handler failed:", error);
    return res.status(500).json({
      error: error?.message || "Gemini analysis failed."
    });
  }
};
