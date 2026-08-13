// File: /api/market.js
// 8담당 Newsletter — KST 08:00 shared daily market snapshot.
//
// Behavior
// 1) Before 08:00 KST: serve the latest saved snapshot.
// 2) After 08:00 KST: the FIRST request refreshes Yahoo once for that KST day.
// 3) Successful data is saved to market-current.json in GitHub.
// 4) Everyone else sees the same saved snapshot all day.
// 5) If Yahoo fails, keep the last successful value instead of showing "조회 불가".
// 6) No Gemini API is used.

const DEFAULT_SYMBOLS = [
  "KSS", "ANF", "M", "KRW=X", "CTZ26.NYB", "CL=F", "BZ=F"
];

const OWNER = process.env.GITHUB_OWNER || "supermegayoon";
const REPO = process.env.GITHUB_REPO || "Newsletter-for-Div-8";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const FILE_PATH = "market-current.json";
const REFRESH_HOUR_KST = 8;

function safeNumber(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function kstParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  const o = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { date: `${o.year}-${o.month}-${o.day}`, hour: Number(o.hour) };
}

function snapshotIsCurrent(snapshot) {
  if (!snapshot?.snapshotDateKST) return false;
  const now = kstParts();
  // Once today's 08:00 KST has passed, require today's snapshot.
  if (now.hour >= REFRESH_HOUR_KST) return snapshot.snapshotDateKST === now.date;
  // Before 08:00 KST, yesterday/latest snapshot remains valid.
  return true;
}

async function fetchYahooChart(symbol) {
  const encoded = encodeURIComponent(symbol);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}` +
    `?interval=1d&range=10d&includePrePost=false`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json,text/plain,*/*"
    }
  });

  if (!response.ok) throw new Error(`Yahoo ${response.status} for ${symbol}`);

  const json = await response.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No market data for ${symbol}`);

  const meta = result.meta || {};
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const validCloses = closes.filter(v => typeof v === "number" && Number.isFinite(v));

  // For a daily morning snapshot, prefer the latest completed daily close.
  // Yahoo's regularMarketPrice can be stale/after-hours depending on the asset.
  let price = validCloses.length ? validCloses[validCloses.length - 1] : safeNumber(meta.regularMarketPrice);
  let previousClose = validCloses.length >= 2
    ? validCloses[validCloses.length - 2]
    : (safeNumber(meta.previousClose) ?? safeNumber(meta.chartPreviousClose));

  const changePct =
    price !== null && previousClose !== null && previousClose !== 0
      ? ((price - previousClose) / previousClose) * 100
      : null;

  return {
    symbol, price, previousClose, changePct,
    currency: meta.currency || null,
    exchangeName: meta.exchangeName || null,
    marketState: meta.marketState || null,
    regularMarketTime: meta.regularMarketTime || null,
    shortName: meta.shortName || meta.longName || null
  };
}

async function githubRequest(url, options = {}) {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN missing");

  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch {}

  if (!response.ok) throw new Error(json?.message || `GitHub ${response.status}`);
  return json;
}

async function readSaved() {
  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${encodeURIComponent(BRANCH)}`;
    const json = await githubRequest(url);
    const content = Buffer.from(String(json.content || "").replace(/\n/g, ""), "base64").toString("utf8");
    return { data: JSON.parse(content), sha: json.sha };
  } catch (e) {
    // First deployment may not have market-current.json yet.
    return { data: null, sha: null, error: e.message };
  }
}

async function saveSnapshot(snapshot, sha) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
  const content = Buffer.from(JSON.stringify(snapshot, null, 2) + "\n", "utf8").toString("base64");
  const body = {
    message: `Daily market snapshot ${snapshot.snapshotDateKST} KST`,
    content,
    branch: BRANCH
  };
  if (sha) body.sha = sha;

  return githubRequest(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function buildSnapshot(symbols, previous) {
  const settled = await Promise.allSettled(symbols.map(fetchYahooChart));
  const data = {};
  const errors = {};

  settled.forEach((result, index) => {
    const symbol = symbols[index];

    if (result.status === "fulfilled" && result.value?.price != null) {
      data[symbol] = result.value;
    } else if (previous?.data?.[symbol]?.price != null) {
      // Critical fallback: retain last successful symbol value.
      data[symbol] = previous.data[symbol];
      errors[symbol] = `${result.reason?.message || "Refresh failed"}; retained previous snapshot`;
    } else {
      data[symbol] = null;
      errors[symbol] = result.reason?.message || "No previous snapshot";
    }
  });

  const now = kstParts();
  const okCount = Object.values(data).filter(x => x?.price != null).length;

  if (!okCount) throw new Error("No market data and no saved fallback available");

  return {
    ok: true,
    source: "Yahoo Finance daily snapshot",
    schedule: "08:00 KST",
    snapshotDateKST: now.date,
    updatedAt: new Date().toISOString(),
    data,
    errors
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // CDN may serve the same result for an hour; underlying GitHub snapshot is daily.
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=21600");

  const requested = String(req.query.symbols || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const symbols = requested.length ? requested.slice(0, 12) : DEFAULT_SYMBOLS;

  const saved = await readSaved();

  // Normal path: today's shared snapshot already exists.
  if (saved.data && snapshotIsCurrent(saved.data)) {
    return res.status(200).json({
      ...saved.data,
      servedFrom: "saved",
      sharedSnapshot: true
    });
  }

  try {
    const fresh = await buildSnapshot(symbols, saved.data);

    try {
      await saveSnapshot(fresh, saved.sha);
    } catch (saveError) {
      // Data is still usable even if GitHub write fails.
      fresh.saveWarning = saveError.message;
    }

    return res.status(200).json({
      ...fresh,
      servedFrom: "fresh",
      sharedSnapshot: true
    });
  } catch (refreshError) {
    if (saved.data) {
      return res.status(200).json({
        ...saved.data,
        stale: true,
        servedFrom: "stale",
        refreshError: refreshError.message,
        sharedSnapshot: true
      });
    }

    return res.status(502).json({
      ok: false,
      error: refreshError.message
    });
  }
};
