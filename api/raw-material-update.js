// File: /api/raw-material-update.js
// GET  -> read latest raw-materials.json directly from GitHub (no Vercel redeploy needed)
// POST -> paste weekly email -> Gemini parse -> update GitHub raw-materials.json

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const OWNER = process.env.GITHUB_OWNER || "supermegayoon";
const REPO = process.env.GITHUB_REPO || "Newsletter-for-Div-8";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const FILE_PATH = "raw-materials.json";

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map(p => p?.text || "").join("\n").trim();
}

function stripFence(text) {
  return String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function githubRequest(url, options = {}) {
  const headers = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(options.headers || {})
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const r = await fetch(url, {...options, headers});
  const text = await r.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  if (!r.ok) throw new Error(data?.message || `GitHub ${r.status}`);
  return data;
}

async function readLatestRawMaterials() {
  const apiUrl =
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}` +
    `?ref=${encodeURIComponent(BRANCH)}&t=${Date.now()}`;

  const current = await githubRequest(apiUrl);
  if (!current?.content) throw new Error("raw-materials.json content missing");

  const jsonText = Buffer.from(
    String(current.content).replace(/\n/g, ""),
    "base64"
  ).toString("utf8");

  return JSON.parse(jsonText);
}

async function parseWithGemini(emailText) {
  const prompt = `
Extract structured data from this Korean apparel raw-material weekly market email.

Return ONLY valid JSON using exactly this schema:
{
  "source": "Weekly raw material report",
  "rawMaterials": {
    "usCotton": {"price": null, "changePct": null, "unit": "¢/lb", "comment": ""},
    "chinaCotton": {"price": null, "changePct": null, "unit": "¢/lb", "comment": ""},
    "indiaCotton": {"price": null, "changePct": null, "unit": "¢/lb", "comment": ""},
    "psf": {"price": null, "changePct": null, "unit": "¢/lb", "comment": ""},
    "dty": {"price": null, "changePct": null, "unit": "¢/lb", "comment": ""}
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
- Use explicit Fiber price summary numbers when present.
- changePct must be signed numeric percentage.
- 2.84% 상승 or ▲ => 2.84
- 0.34% 하락 or ▼ => -0.34
- If missing, use null.
- Never invent values.
- Keep comments concise, in Korean.
- summary should be concise Korean business interpretation.
- Do not include markdown.

EMAIL:
${emailText}
`.trim();

  const r = await fetch(`${GEMINI_BASE}/${encodeURIComponent(MODEL)}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [{role: "user", parts: [{text: prompt}]}],
      generationConfig: {
        maxOutputTokens: 1800,
        responseMimeType: "application/json"
      }
    })
  });

  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `Gemini ${r.status}`);

  const parsed = JSON.parse(stripFence(extractText(j)));
  parsed.updatedAt = new Date().toISOString();
  parsed.source = parsed.source || "Weekly raw material report";
  return parsed;
}

async function updateGitHubFile(contentObj) {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN missing");

  const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;

  let sha = null;
  try {
    const current = await githubRequest(`${apiUrl}?ref=${encodeURIComponent(BRANCH)}`);
    sha = current?.sha || null;
  } catch (e) {
    if (!String(e.message).includes("Not Found")) throw e;
  }

  const content = Buffer.from(
    JSON.stringify(contentObj, null, 2) + "\n",
    "utf8"
  ).toString("base64");

  const body = {
    message: `Update raw material dashboard ${new Date().toISOString().slice(0,10)}`,
    content,
    branch: BRANCH
  };
  if (sha) body.sha = sha;

  return githubRequest(apiUrl, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body)
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

  // IMPORTANT: reuse this existing Serverless Function for reading.
  // This avoids adding a 13th Vercel Function on Hobby plan.
  if (req.method === "GET") {
    try {
      const data = await readLatestRawMaterials();
      return res.status(200).json({ok: true, ...data});
    } catch (e) {
      console.error("[raw-material GET]", e);
      return res.status(500).json({ok: false, error: e?.message || "Read failed"});
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({error: "Method not allowed"});
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({error: "GEMINI_API_KEY missing"});
  }
  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).json({error: "GITHUB_TOKEN missing"});
  }
  if (!process.env.ADMIN_UPDATE_PIN) {
    return res.status(500).json({error: "ADMIN_UPDATE_PIN missing"});
  }

  const pin = String(req.body?.pin || "");
  if (pin !== process.env.ADMIN_UPDATE_PIN) {
    return res.status(401).json({error: "PIN이 맞지 않습니다."});
  }

  const emailText = String(req.body?.emailText || "").trim();
  if (emailText.length < 30) {
    return res.status(400).json({error: "원자재 메일 내용을 붙여넣어 주세요."});
  }

  try {
    const parsed = await parseWithGemini(emailText);
    const gh = await updateGitHubFile(parsed);

    return res.status(200).json({
      ok: true,
      parsed,
      commit: gh?.commit?.html_url || null,
      message: "GitHub 업데이트 완료. Dashboard를 새로고침하면 최신 원자재 데이터가 표시됩니다."
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({error: e?.message || "Update failed"});
  }
};
