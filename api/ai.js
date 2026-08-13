// File: /api/ai.js
// Gemini-powered AI analysis for 8담당 DAILY MARKET BRIEF.
// Store GEMINI_API_KEY only in Vercel Environment Variables.

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function cleanText(value, max = 1200) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeNews(news) {
  if (!Array.isArray(news)) return [];
  return news.slice(0, 12).map(n => ({
    brand: cleanText(n.brandLabel || n.brand, 80),
    date: cleanText(n.date, 30),
    title: cleanText(n.title_kr || n.title_en, 240),
    body: cleanText(n.body_kr || n.body_en, 600),
    source: cleanText(n.source, 100)
  }));
}

function normalizeMarket(market) {
  if (!market || typeof market !== "object") return {};
  const allowed = ["KSS", "ANF", "M", "KRW=X", "VND=X", "CL=F", "CT=F"];
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
  const summary = cleanText(body.summary, 1500);

  if (!news.length && !Object.keys(market).length) {
    return res.status(400).json({ error: "No newsletter data supplied." });
  }

  const prompt = `
You are the AI market analyst for "8담당 DAILY MARKET BRIEF", an internal apparel-vendor sales and sourcing newsletter.

Audience:
- Apparel sales, merchandising, sourcing, costing, production and management teams.
- Key retail/customer relevance includes Kohl's, A&F/Hollister and Macy's.
- Main operational lenses: apparel demand, promotions, sourcing, raw materials, FX, duty/tariff, margin, chase/reorder, production and vendor risk.

Rules:
- Analyze ONLY the information supplied below.
- Do not invent current news, prices, policies, tariffs, dates, earnings estimates, or facts not present in the supplied data.
- Distinguish observed facts from inference.
- If evidence is insufficient, say so clearly.
- Keep the full response concise and under about 650 Korean characters.

Return exactly this structure:

[오늘의 AI 한줄]
<1 sentence>

[8담당 영향도]
• <point 1>
• <point 2>
• <point 3>

[오늘 체크할 것]
1. <action 1>
2. <action 2>
3. <action 3>

[리스크 레벨]
<LOW / MEDIUM / HIGH> — <one short reason>

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
          temperature: 0.25,
          maxOutputTokens: 800
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", response.status, data);
      return res.status(response.status).json({
        error:
          data?.error?.message ||
          `Gemini API returned ${response.status}`
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
