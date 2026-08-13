// File: /api/market.js
// Shared KST 08:00 market snapshot.
// Normal page requests only READ the saved GitHub snapshot.
// Only /api/daily-update calls ?force=1 to create today's snapshot.

const DEFAULT_SYMBOLS = [
  "KSS", "ANF", "M", "KRW=X", "CTZ26.NYB", "CL=F", "BZ=F"
];

const OWNER = process.env.GITHUB_OWNER || "supermegayoon";
const REPO = process.env.GITHUB_REPO || "Newsletter-for-Div-8";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const FILE_PATH = "market-current.json";

function safeNumber(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function kstDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
}

function nyDateFromUnix(ts) {
  if (!ts) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date(ts * 1000));
}

function forceAllowed(req) {
  if (String(req.query?.force || "") !== "1") return false;
  if (!process.env.CRON_SECRET) return true;
  return req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
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
  const timestamps = result?.timestamp || [];

  const valid = [];
  closes.forEach((v, i) => {
    if (typeof v === "number" && Number.isFinite(v)) {
      valid.push({ price: v, ts: timestamps[i] || null });
    }
  });

  let price = valid.length ? valid[valid.length - 1].price : safeNumber(meta.regularMarketPrice);
  let previousClose = valid.length >= 2
    ? valid[valid.length - 2].price
    : (safeNumber(meta.previousClose) ?? safeNumber(meta.chartPreviousClose));

  const changePct =
    price !== null && previousClose !== null && previousClose !== 0
      ? ((price - previousClose) / previousClose) * 100
      : null;

  const latestTs = valid.length ? valid[valid.length - 1].ts : meta.regularMarketTime;

  return {
    symbol,
    price,
    previousClose,
    changePct,
    dataDate: nyDateFromUnix(latestTs),
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
      data[symbol] = previous.data[symbol];
      errors[symbol] = `${result.reason?.message || "Refresh failed"}; retained previous snapshot`;
    } else {
      data[symbol] = null;
      errors[symbol] = result.reason?.message || "No previous snapshot";
    }
  });

  const okCount = Object.values(data).filter(x => x?.price != null).length;
  if (!okCount) throw new Error("No market data and no saved fallback available");

  // U.S. retail stocks share the relevant previous U.S. trading date.
  const marketDataDate =
    data.KSS?.dataDate || data.ANF?.dataDate || data.M?.dataDate || null;

  return {
    ok: true,
    source: "Yahoo Finance daily snapshot",
    schedule: "08:00 KST",
    snapshotDateKST: kstDate(),
    marketDataDate,
    updatedAt: new Date().toISOString(),
    status: "success",
    data,
    errors
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "no-store");

  const requested = String(req.query?.symbols || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const symbols = requested.length ? requested.slice(0, 12) : DEFAULT_SYMBOLS;

  const saved = await readSaved();
  const force = forceAllowed(req);

  // Normal browser request: NEVER hits Yahoo. Read the saved daily snapshot only.
  if (!force && saved.data) {
    return res.status(200).json({
      ...saved.data,
      servedFrom: "saved",
      sharedSnapshot: true
    });
  }

  // Bootstrap fallback when no saved file exists yet.
  if (!force && !saved.data) {
    return res.status(503).json({
      ok: false,
      error: "No saved market snapshot exists yet. Run /api/daily-update once."
    });
  }

  if (String(req.query?.force || "") === "1" && !force) {
    return res.status(401).json({ error: "Unauthorized forced refresh" });
  }

  try {
    const fresh = await buildSnapshot(symbols, saved.data);

    try {
      await saveSnapshot(fresh, saved.sha);
    } catch (saveError) {
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
        status: "stale_fallback",
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
