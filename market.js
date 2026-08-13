// Vercel Serverless Function
// File: /api/market.js
// Purpose: Fetch Yahoo Finance data server-side to avoid browser CORS blocks.

const DEFAULT_SYMBOLS = ["KSS", "ANF", "M", "KRW=X", "VND=X", "CL=F", "CT=F"];

function safeNumber(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function fetchYahooChart(symbol) {
  const encoded = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=5d&includePrePost=false`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json,text/plain,*/*"
    }
  });

  if (!response.ok) {
    throw new Error(`Yahoo ${response.status} for ${symbol}`);
  }

  const data = await response.json();
  const result = data?.chart?.result?.[0];

  if (!result) {
    throw new Error(`No market data for ${symbol}`);
  }

  const meta = result.meta || {};
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const validCloses = closes.filter(v => typeof v === "number" && Number.isFinite(v));

  let price = safeNumber(meta.regularMarketPrice);
  if (price === null && validCloses.length) {
    price = validCloses[validCloses.length - 1];
  }

  let previousClose =
    safeNumber(meta.previousClose) ??
    safeNumber(meta.chartPreviousClose);

  if (previousClose === null && validCloses.length >= 2) {
    previousClose = validCloses[validCloses.length - 2];
  }

  const changePct =
    price !== null && previousClose !== null && previousClose !== 0
      ? ((price - previousClose) / previousClose) * 100
      : null;

  return {
    symbol,
    price,
    previousClose,
    changePct,
    currency: meta.currency || null,
    exchangeName: meta.exchangeName || null,
    marketState: meta.marketState || null,
    regularMarketTime: meta.regularMarketTime || null
  };
}

module.exports = async function handler(req, res) {
  // Allow only GET
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Cache briefly at Vercel edge/CDN.
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  const requested = String(req.query.symbols || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const symbols = requested.length ? requested.slice(0, 12) : DEFAULT_SYMBOLS;

  const settled = await Promise.allSettled(symbols.map(fetchYahooChart));

  const data = {};
  const errors = {};

  settled.forEach((result, index) => {
    const symbol = symbols[index];
    if (result.status === "fulfilled") {
      data[symbol] = result.value;
    } else {
      data[symbol] = null;
      errors[symbol] = result.reason?.message || "Unknown error";
    }
  });

  const okCount = Object.values(data).filter(Boolean).length;

  return res.status(okCount ? 200 : 502).json({
    ok: okCount > 0,
    source: "Yahoo Finance",
    updatedAt: new Date().toISOString(),
    data,
    errors
  });
};
