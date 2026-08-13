// File: /api/raw-material-parse.js
// Parse the weekly raw-material email with Gemini.
// Requires GEMINI_API_KEY in Vercel Environment Variables.

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map(p => p?.text || "").join("\n").trim();
}

function stripCodeFence(text) {
  return String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured." });
  }

  const emailText = String(req.body?.emailText || "").trim();

  if (emailText.length < 30) {
    return res.status(400).json({ error: "원자재 메일 내용을 충분히 붙여넣어 주세요." });
  }

  const prompt = `
You extract structured raw-material market data from a Korean apparel sourcing weekly market email.

Return ONLY valid JSON. No markdown, no explanation.

Required schema:
{
  "reportDate": "",
  "usCotton": {
    "price": null,
    "changePct": null,
    "comment": ""
  },
  "chinaCotton": {
    "price": null,
    "changePct": null,
    "comment": ""
  },
  "indiaCotton": {
    "price": null,
    "changePct": null,
    "comment": ""
  },
  "psf": {
    "price": null,
    "changePct": null,
    "comment": ""
  },
  "dty": {
    "price": null,
    "changePct": null,
    "comment": ""
  },
  "yarn": {
    "india": "",
    "china": "",
    "korea": "",
    "cafta": "",
    "vietnam": ""
  },
  "summary": {
    "cotton": "",
    "polyester": "",
    "yarn": ""
  }
}

Rules:
- Prices are numeric cents/lb where the email gives cents/lb.
- changePct is signed numeric percent. Example "2.84% 상승" => 2.84, "0.34%▼" => -0.34.
- If a value is missing, return null.
- Keep each comment concise, ideally one Korean sentence.
- Do not invent values.
- For U.S. cotton, use the explicit "Fiber price 요약" value when available.
- reportDate should use a date explicitly stated in the email; otherwise leave empty.
- summary.cotton should summarize U.S./China/India cotton direction.
- summary.polyester should summarize PSF/DTY direction.
- summary.yarn should summarize the yarn market section.

EMAIL:
${emailText}
`.trim();

  try {
    const response = await fetch(
      `${API_BASE}/${encodeURIComponent(MODEL)}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": process.env.GEMINI_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 1800,
            responseMimeType: "application/json"
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || `Gemini API returned ${response.status}`
      });
    }

    const text = stripCodeFence(extractText(data));
    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(502).json({
        error: "Gemini 결과를 JSON으로 읽지 못했습니다.",
        raw: text.slice(0, 1200)
      });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      model: MODEL,
      parsed
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Raw material parse failed."
    });
  }
};
