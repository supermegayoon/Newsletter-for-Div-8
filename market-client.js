// File: /market-client.js
// Add this line before </body> in index.html:
// <script src="market-client.js"></script>

(() => {
  const SYMBOLS = ["KSS", "ANF", "M", "KRW=X", "VND=X", "CL=F", "CT=F"];

  const fmt = (n, digits = 2) =>
    Number(n).toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });

  const pctHtml = (change) => {
    if (change === null || change === undefined || !Number.isFinite(change)) {
      return `<small class="flat">—</small>`;
    }
    const dir = change > 0 ? "up" : change < 0 ? "down" : "flat";
    const arrow = change > 0 ? "▲" : change < 0 ? "▼" : "";
    return `<small class="${dir}">${arrow} ${Math.abs(change).toFixed(2)}%</small>`;
  };

  async function loadMarket() {
    const url = `/api/market?symbols=${encodeURIComponent(SYMBOLS.join(","))}`;
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      throw new Error(`Market API returned ${res.status}`);
    }

    return res.json();
  }

  function renderStocks(data) {
    const grid = document.getElementById("kpi-grid");
    if (!grid) return;

    const stockDefs = [
      { symbol: "KSS", label: "Kohl's (KSS)" },
      { symbol: "ANF", label: "Abercrombie & Fitch (ANF)" },
      { symbol: "M", label: "Macy's (M)" }
    ];

    grid.innerHTML = stockDefs.map(item => {
      const d = data[item.symbol];
      if (!d || d.price === null) {
        return `
          <div class="kpi-card">
            <div class="kpi-label">${item.label}</div>
            <div class="kpi-value" style="font-size:16px;color:var(--muted)">조회 불가</div>
            <div class="kpi-delta flat">—</div>
          </div>`;
      }

      const dir = d.changePct > 0 ? "up" : d.changePct < 0 ? "down" : "flat";
      const arrow = d.changePct > 0 ? "▲" : d.changePct < 0 ? "▼" : "";

      return `
        <div class="kpi-card">
          <div class="kpi-label">${item.label}</div>
          <div class="kpi-value">$${fmt(d.price)}</div>
          <div class="kpi-delta ${dir}">
            ${arrow} ${d.changePct === null ? "—" : Math.abs(d.changePct).toFixed(2) + "%"}
          </div>
        </div>`;
    }).join("");
  }

  function renderKRW(data) {
    const d = data["KRW=X"];
    const val = document.getElementById("fx-val");
    const note = document.getElementById("fx-note");
    if (!val) return;

    if (!d || d.price === null) {
      val.innerHTML = `<span style="font-size:14px;color:var(--muted)">조회 불가</span>`;
      return;
    }

    val.innerHTML =
      `₩${Number(d.price).toLocaleString("ko-KR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} ${pctHtml(d.changePct)}`;

    if (note) {
      note.innerHTML =
        `<span class="kr">Yahoo Finance · 서버 연동</span>` +
        `<span class="en">Yahoo Finance · Server-side feed</span>`;
    }
  }

  function marketCard(id, titleKr, titleEn, valueHtml, noteKr, noteEn) {
    return `
      <div class="r-card" id="${id}">
        <div class="r-title">
          <span class="kr">${titleKr}</span><span class="en">${titleEn}</span>
        </div>
        <div class="r-big">${valueHtml}</div>
        <div class="r-note">
          <span class="kr">${noteKr}</span><span class="en">${noteEn}</span>
        </div>
      </div>`;
  }

  function renderExtraTicker(data) {
    const rightCol = document.querySelector(".right-col");
    const fxCard = document.getElementById("fx-val")?.closest(".r-card");
    if (!rightCol || !fxCard) return;

    document.getElementById("market-extra-wrap")?.remove();

    const vnd = data["VND=X"];
    const oil = data["CL=F"];
    const cotton = data["CT=F"];

    const vndValue = vnd?.price != null
      ? `₫${Number(vnd.price).toLocaleString("en-US", {maximumFractionDigits: 0})} ${pctHtml(vnd.changePct)}`
      : `<span style="font-size:14px;color:var(--muted)">조회 불가</span>`;

    const oilValue = oil?.price != null
      ? `$${fmt(oil.price)} ${pctHtml(oil.changePct)}`
      : `<span style="font-size:14px;color:var(--muted)">조회 불가</span>`;

    const cottonValue = cotton?.price != null
      ? `${fmt(cotton.price)} ${pctHtml(cotton.changePct)}`
      : `<span style="font-size:14px;color:var(--muted)">조회 불가</span>`;

    const wrap = document.createElement("div");
    wrap.id = "market-extra-wrap";
    wrap.style.display = "contents";
    wrap.innerHTML =
      marketCard(
        "fx-vnd-card",
        "USD → VND 환율",
        "USD → VND",
        vndValue,
        "실시간 시장 환율",
        "Live market rate"
      ) +
      marketCard(
        "wti-card",
        "WTI 원유",
        "WTI Crude Oil",
        oilValue,
        "NYMEX 근월물 · USD/bbl",
        "NYMEX front month · USD/bbl"
      ) +
      marketCard(
        "cotton-card",
        "Cotton No.2",
        "Cotton No.2",
        cottonValue,
        "ICE 선물 · cents/lb",
        "ICE futures · cents/lb"
      );

    fxCard.insertAdjacentElement("afterend", wrap);
  }

  async function refreshMarket() {
    try {
      const result = await loadMarket();
      renderStocks(result.data || {});
      renderKRW(result.data || {});
      renderExtraTicker(result.data || {});
      console.log("[Market] updated", result.updatedAt);
    } catch (err) {
      console.error("[Market] failed:", err);
      const fx = document.getElementById("fx-val");
      if (fx) fx.innerHTML =
        `<span style="font-size:14px;color:var(--muted)">조회 불가</span>`;
    }
  }

  // Existing index.html already runs its old Yahoo-browser fetch first.
  // This script runs immediately after it and replaces the cards using /api/market.
  refreshMarket();

  // Refresh every 5 minutes while the page is open.
  setInterval(refreshMarket, 5 * 60 * 1000);
})();
