// File: /ai-client.js
// Adds the Gemini-powered "8담당 AI Market Insight" card.

(() => {
  const STYLE_ID = "ai-insight-style";
  const CARD_ID = "ai-insight-card";

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .ai-card{
        background:var(--panel);
        border:1px solid var(--line);
        border-radius:14px;
        padding:22px 24px;
        box-shadow:var(--shadow);
        margin:0 0 24px;
        position:relative;
        overflow:hidden;
      }
      .ai-card:before{
        content:"";
        position:absolute;
        left:0;top:0;bottom:0;
        width:4px;
        background:var(--accent);
      }
      .ai-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin-bottom:12px;
      }
      .ai-title{
        display:flex;
        align-items:center;
        gap:9px;
        font-size:15px;
        font-weight:800;
      }
      .ai-badge{
        font-family:var(--mono);
        font-size:10px;
        font-weight:700;
        color:#fff;
        background:var(--accent);
        border-radius:5px;
        padding:3px 7px;
        letter-spacing:.04em;
      }
      .ai-refresh{
        border:1px solid var(--line);
        background:var(--panel2);
        color:var(--text);
        border-radius:8px;
        padding:7px 10px;
        font:600 11px var(--font);
        cursor:pointer;
      }
      .ai-refresh:hover{border-color:var(--accent);color:var(--accent);}
      .ai-refresh:disabled{opacity:.5;cursor:wait;}
      .ai-body{
        font-size:13.5px;
        line-height:1.75;
        white-space:pre-wrap;
        color:var(--text);
      }
      .ai-meta{
        margin-top:11px;
        font-size:10.5px;
        color:var(--muted);
      }
      .ai-error{color:var(--red);}
    `;
    document.head.appendChild(style);
  }

  function createCard() {
    if (document.getElementById(CARD_ID)) return document.getElementById(CARD_ID);

    const hero = document.querySelector(".hero-card");
    if (!hero) return null;

    const card = document.createElement("section");
    card.id = CARD_ID;
    card.className = "ai-card";
    card.innerHTML = `
      <div class="ai-head">
        <div class="ai-title">
          <span class="ai-badge">GEMINI AI</span>
          <span class="kr">8담당 AI Market Insight</span>
          <span class="en">Team 8 AI Market Insight</span>
        </div>
        <button class="ai-refresh" type="button">
          <span class="kr">AI 분석</span><span class="en">Analyze</span>
        </button>
      </div>
      <div class="ai-body">
        <span class="kr">현재 뉴스와 시장 데이터를 기준으로 Gemini 분석을 생성합니다.</span>
        <span class="en">Generate a Gemini analysis from the current market data and news.</span>
      </div>
      <div class="ai-meta"></div>
    `;
    hero.insertAdjacentElement("afterend", card);
    return card;
  }

  async function getMarketData() {
    try {
      const res = await fetch("/api/market", { cache: "no-store" });
      if (!res.ok) return {};
      const json = await res.json();
      return json.data || {};
    } catch {
      return {};
    }
  }

  function buildPayload(market) {
    return {
      headline: window.CONFIG?.headline?.kr || "",
      summary: window.CONFIG?.summary?.kr || "",
      news: Array.isArray(window.CONFIG?.news) ? window.CONFIG.news : [],
      market
    };
  }

  async function runAI() {
    const card = createCard();
    if (!card) return;

    const button = card.querySelector(".ai-refresh");
    const body = card.querySelector(".ai-body");
    const meta = card.querySelector(".ai-meta");

    button.disabled = true;
    body.classList.remove("ai-error");
    body.textContent = "Gemini 분석 중…";
    meta.textContent = "";

    try {
      const market = await getMarketData();
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(market))
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || `AI API returned ${res.status}`);
      }

      body.textContent = json.text;
      const time = new Date(json.updatedAt).toLocaleString();
      meta.textContent = `${json.provider} · ${json.model} · ${time}`;
    } catch (err) {
      body.classList.add("ai-error");
      body.textContent = `AI 분석 실패: ${err.message}`;
    } finally {
      button.disabled = false;
    }
  }

  installStyle();
  const card = createCard();
  card?.querySelector(".ai-refresh")?.addEventListener("click", runAI);
})();
