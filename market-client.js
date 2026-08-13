// File: /market-client.js
// Raw Material Dashboard version
// Auto: USD/KRW, U.S. Cotton Dec-26, WTI, Brent
// Manual fallback from CONFIG.rawMaterials: China Cotton, India Cotton, PSF, DTY

(() => {
  const SYMBOLS = [
    "KSS",
    "ANF",
    "M",
    "KRW=X",
    "CTZ26.NYB",
    "CL=F",
    "BZ=F"
  ];

  const fmt = (n, digits = 2) =>
    Number(n).toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });

  const pctClass = (change) =>
    change > 0 ? "up" : change < 0 ? "down" : "flat";

  const pctText = (change) => {
    if (change === null || change === undefined || !Number.isFinite(Number(change))) return "—";
    const n = Number(change);
    const arrow = n > 0 ? "▲" : n < 0 ? "▼" : "";
    return `${arrow} ${Math.abs(n).toFixed(2)}%`;
  };

  async function loadMarket() {
    const url = `/api/market?symbols=${encodeURIComponent(SYMBOLS.join(","))}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Market API returned ${res.status}`);
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
      if (!d || d.price == null) {
        return `
          <div class="kpi-card">
            <div class="kpi-label">${item.label}</div>
            <div class="kpi-value" style="font-size:16px;color:var(--muted)">조회 불가</div>
            <div class="kpi-delta flat">—</div>
          </div>`;
      }

      return `
        <div class="kpi-card">
          <div class="kpi-label">${item.label}</div>
          <div class="kpi-value">$${fmt(d.price)}</div>
          <div class="kpi-delta ${pctClass(d.changePct)}">${pctText(d.changePct)}</div>
        </div>`;
    }).join("");
  }

  function renderKRW(data) {
    const d = data["KRW=X"];
    const val = document.getElementById("fx-val");
    const note = document.getElementById("fx-note");
    if (!val) return;

    if (!d || d.price == null) {
      val.innerHTML = `<span style="font-size:14px;color:var(--muted)">조회 불가</span>`;
      return;
    }

    val.innerHTML =
      `₩${Number(d.price).toLocaleString("ko-KR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} <small class="${pctClass(d.changePct)}">${pctText(d.changePct)}</small>`;

    if (note) {
      note.innerHTML =
        `<span class="kr">USD/KRW · 시장 환율</span>` +
        `<span class="en">USD/KRW · Market rate</span>`;
    }
  }

  function manualMaterial(key) {
    return window.CONFIG?.rawMaterials?.[key] || null;
  }

  function buildMaterialItem({
    labelKr, labelEn, price, changePct, unit, source, status = "auto"
  }) {
    const hasPrice = price !== null && price !== undefined && Number.isFinite(Number(price));
    return `
      <div class="rm-item">
        <div class="rm-top">
          <div>
            <div class="rm-name">
              <span class="kr">${labelKr}</span>
              <span class="en">${labelEn}</span>
            </div>
            <div class="rm-source">${source || ""}</div>
          </div>
          <div class="rm-status ${status}">
            ${status === "auto" ? "AUTO" : "MANUAL"}
          </div>
        </div>
        <div class="rm-value">
          ${hasPrice ? fmt(price) : "—"}
          <span class="rm-unit">${unit || ""}</span>
        </div>
        <div class="rm-change ${pctClass(Number(changePct))}">
          ${pctText(Number(changePct))}
        </div>
      </div>`;
  }

  function installRawMaterialStyles() {
    if (document.getElementById("raw-material-dashboard-style")) return;

    const style = document.createElement("style");
    style.id = "raw-material-dashboard-style";
    style.textContent = `
      .rm-dashboard{
        background:var(--panel);
        border:1px solid var(--line);
        border-radius:14px;
        padding:20px;
        box-shadow:var(--shadow);
        margin:0 0 24px;
      }
      .rm-header{
        display:flex;
        justify-content:space-between;
        align-items:flex-end;
        gap:12px;
        margin-bottom:15px;
      }
      .rm-title{
        font-size:15px;
        font-weight:800;
      }
      .rm-subtitle{
        font-size:10.5px;
        color:var(--muted);
        margin-top:3px;
      }
      .rm-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:10px;
      }
      .rm-item{
        background:var(--panel2);
        border:1px solid var(--line);
        border-radius:10px;
        padding:13px;
        min-width:0;
      }
      .rm-top{
        display:flex;
        justify-content:space-between;
        gap:8px;
        align-items:flex-start;
      }
      .rm-name{
        font-size:12px;
        font-weight:750;
      }
      .rm-source{
        font-size:9.5px;
        color:var(--muted);
        margin-top:2px;
      }
      .rm-status{
        font:700 8px var(--mono);
        padding:2px 5px;
        border-radius:4px;
        border:1px solid var(--line);
      }
      .rm-status.auto{color:var(--green);}
      .rm-status.manual{color:var(--orange);}
      .rm-value{
        margin-top:9px;
        font-size:21px;
        font-weight:800;
        letter-spacing:-.02em;
      }
      .rm-unit{
        font-size:9.5px;
        font-weight:600;
        color:var(--muted);
        margin-left:3px;
      }
      .rm-change{
        margin-top:4px;
        font-size:10.5px;
        font-weight:700;
      }
      @media(max-width:700px){
        .rm-grid{grid-template-columns:1fr;}
      }
    `;
    document.head.appendChild(style);
  }

  function renderRawMaterialDashboard(data) {
    installRawMaterialStyles();

    const rightCol = document.querySelector(".right-col");
    const fxCard = document.getElementById("fx-val")?.closest(".r-card");
    if (!rightCol || !fxCard) return;

    document.getElementById("raw-material-dashboard")?.remove();
    document.getElementById("market-extra-wrap")?.remove();

    const usCotton = data["CTZ26.NYB"];
    const wti = data["CL=F"];
    const brent = data["BZ=F"];

    const china = manualMaterial("chinaCotton");
    const india = manualMaterial("indiaCotton");
    const psf = manualMaterial("psf");
    const dty = manualMaterial("dty");

    const panel = document.createElement("section");
    panel.id = "raw-material-dashboard";
    panel.className = "rm-dashboard";

    panel.innerHTML = `
      <div class="rm-header">
        <div>
          <div class="rm-title">
            <span class="kr">RAW MATERIAL DASHBOARD</span>
            <span class="en">RAW MATERIAL DASHBOARD</span>
          </div>
          <div class="rm-subtitle">
            <span class="kr">자동 시장지표 + 주간 원자재 리포트</span>
            <span class="en">Live indicators + weekly raw material report</span>
          </div>
        </div>
      </div>

      <div class="rm-grid">
        ${buildMaterialItem({
          labelKr:"미국 면", labelEn:"U.S. Cotton",
          price:usCotton?.price, changePct:usCotton?.changePct,
          unit:"¢/lb", source:"ICE Cotton No.2 · Dec 2026", status:"auto"
        })}
        ${buildMaterialItem({
          labelKr:"중국 면", labelEn:"China Cotton",
          price:china?.price, changePct:china?.changePct,
          unit:china?.unit || "¢/lb", source:china?.source || "Weekly report", status:"manual"
        })}
        ${buildMaterialItem({
          labelKr:"인도 면", labelEn:"India Cotton",
          price:india?.price, changePct:india?.changePct,
          unit:india?.unit || "¢/lb", source:india?.source || "Weekly report", status:"manual"
        })}
        ${buildMaterialItem({
          labelKr:"PSF", labelEn:"PSF",
          price:psf?.price, changePct:psf?.changePct,
          unit:psf?.unit || "¢/lb", source:psf?.source || "Weekly report", status:"manual"
        })}
        ${buildMaterialItem({
          labelKr:"DTY", labelEn:"DTY",
          price:dty?.price, changePct:dty?.changePct,
          unit:dty?.unit || "¢/lb", source:dty?.source || "Weekly report", status:"manual"
        })}
        ${buildMaterialItem({
          labelKr:"WTI 원유", labelEn:"WTI Crude",
          price:wti?.price, changePct:wti?.changePct,
          unit:"USD/bbl", source:"NYMEX · polyester upstream proxy", status:"auto"
        })}
        ${buildMaterialItem({
          labelKr:"Brent 원유", labelEn:"Brent Crude",
          price:brent?.price, changePct:brent?.changePct,
          unit:"USD/bbl", source:"Global oil benchmark", status:"auto"
        })}
      </div>
    `;

    fxCard.insertAdjacentElement("afterend", panel);
  }

  async function refreshMarket() {
    try {
      const result = await loadMarket();
      renderStocks(result.data || {});
      renderKRW(result.data || {});
      renderRawMaterialDashboard(result.data || {});
    } catch (err) {
      console.error("[Market] failed:", err);
    }
  }

  refreshMarket();
  setInterval(refreshMarket, 5 * 60 * 1000);
})();
