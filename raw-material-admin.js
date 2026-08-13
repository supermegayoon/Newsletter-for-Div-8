// File: /raw-material-admin.js
// Adds a small editor at the bottom of the newsletter.
// Paste the weekly email -> Gemini parses -> copy generated CONFIG block.
// This DOES NOT write to GitHub automatically. It creates ready-to-paste code safely.

(() => {
  const STYLE_ID = "rm-admin-style";
  const PANEL_ID = "rm-admin-panel";

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .rm-admin{
        max-width:1180px;
        margin:28px auto 60px;
        padding:0 20px;
      }
      .rm-admin-box{
        background:var(--panel);
        border:1px dashed var(--line);
        border-radius:14px;
        padding:18px;
      }
      .rm-admin-head{
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:center;
        margin-bottom:12px;
      }
      .rm-admin-title{font-size:14px;font-weight:800}
      .rm-admin small{color:var(--muted)}
      .rm-admin textarea{
        width:100%;
        min-height:180px;
        resize:vertical;
        border:1px solid var(--line);
        border-radius:10px;
        background:var(--panel2);
        color:var(--text);
        padding:12px;
        font:12px/1.55 var(--font);
        box-sizing:border-box;
      }
      .rm-admin-actions{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        margin-top:10px;
      }
      .rm-admin button{
        border:1px solid var(--line);
        border-radius:8px;
        padding:8px 11px;
        background:var(--panel2);
        color:var(--text);
        font:700 11px var(--font);
        cursor:pointer;
      }
      .rm-admin button.primary{
        background:var(--accent);
        color:white;
        border-color:var(--accent);
      }
      .rm-admin button:disabled{opacity:.5;cursor:wait}
      .rm-admin-result{
        margin-top:14px;
        display:none;
      }
      .rm-admin-grid{
        display:grid;
        grid-template-columns:repeat(5,minmax(0,1fr));
        gap:8px;
        margin:10px 0;
      }
      .rm-admin-mini{
        border:1px solid var(--line);
        border-radius:8px;
        padding:9px;
        background:var(--panel2);
      }
      .rm-admin-mini b{display:block;font-size:11px}
      .rm-admin-mini span{font-size:12px}
      .rm-admin-code{
        min-height:210px!important;
        font-family:var(--mono)!important;
      }
      @media(max-width:800px){
        .rm-admin-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      }
    `;
    document.head.appendChild(style);
  }

  function makeConfigBlock(p) {
    const q = (s) => JSON.stringify(String(s || ""));
    const num = (n) => (n === null || n === undefined || n === "" ? "null" : Number(n));

    return `rawMaterials: {
  usCotton: {
    price: ${num(p.usCotton?.price)},
    changePct: ${num(p.usCotton?.changePct)},
    unit: "¢/lb",
    source: "Weekly raw material report",
    comment: ${q(p.usCotton?.comment)}
  },
  chinaCotton: {
    price: ${num(p.chinaCotton?.price)},
    changePct: ${num(p.chinaCotton?.changePct)},
    unit: "¢/lb",
    source: "Weekly raw material report",
    comment: ${q(p.chinaCotton?.comment)}
  },
  indiaCotton: {
    price: ${num(p.indiaCotton?.price)},
    changePct: ${num(p.indiaCotton?.changePct)},
    unit: "¢/lb",
    source: "Weekly raw material report",
    comment: ${q(p.indiaCotton?.comment)}
  },
  psf: {
    price: ${num(p.psf?.price)},
    changePct: ${num(p.psf?.changePct)},
    unit: "¢/lb",
    source: "Weekly raw material report",
    comment: ${q(p.psf?.comment)}
  },
  dty: {
    price: ${num(p.dty?.price)},
    changePct: ${num(p.dty?.changePct)},
    unit: "¢/lb",
    source: "Weekly raw material report",
    comment: ${q(p.dty?.comment)}
  },
  yarn: {
    india: ${q(p.yarn?.india)},
    china: ${q(p.yarn?.china)},
    korea: ${q(p.yarn?.korea)},
    cafta: ${q(p.yarn?.cafta)},
    vietnam: ${q(p.yarn?.vietnam)}
  },
  summary: {
    cotton: ${q(p.summary?.cotton)},
    polyester: ${q(p.summary?.polyester)},
    yarn: ${q(p.summary?.yarn)}
  }
},`;
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const host = document.createElement("div");
    host.id = PANEL_ID;
    host.className = "rm-admin";
    host.innerHTML = `
      <div class="rm-admin-box">
        <div class="rm-admin-head">
          <div>
            <div class="rm-admin-title">원자재 메일 → Dashboard 업데이트 도우미</div>
            <small>메일 전체를 붙여넣으면 Gemini가 가격/등락/코멘트를 추출합니다.</small>
          </div>
        </div>

        <textarea class="rm-email-input" placeholder="여기에 매주 받는 원자재 가격 동향 메일을 그대로 붙여넣으세요."></textarea>

        <div class="rm-admin-actions">
          <button class="primary rm-parse-btn">Gemini로 추출</button>
          <button class="rm-clear-btn">지우기</button>
        </div>

        <div class="rm-admin-result">
          <div class="rm-admin-grid"></div>
          <small>아래 코드를 복사해서 data.js의 기존 rawMaterials 블록과 교체하면 됩니다.</small>
          <textarea class="rm-admin-code" readonly></textarea>
          <div class="rm-admin-actions">
            <button class="rm-copy-btn">코드 복사</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(host);

    const input = host.querySelector(".rm-email-input");
    const parseBtn = host.querySelector(".rm-parse-btn");
    const clearBtn = host.querySelector(".rm-clear-btn");
    const result = host.querySelector(".rm-admin-result");
    const grid = host.querySelector(".rm-admin-grid");
    const code = host.querySelector(".rm-admin-code");
    const copyBtn = host.querySelector(".rm-copy-btn");

    parseBtn.addEventListener("click", async () => {
      const emailText = input.value.trim();
      if (!emailText) return alert("원자재 메일 내용을 붙여넣어 주세요.");

      parseBtn.disabled = true;
      parseBtn.textContent = "추출 중…";

      try {
        const res = await fetch("/api/raw-material-parse", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ emailText })
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `API ${res.status}`);

        const p = json.parsed || {};
        const items = [
          ["U.S. Cotton", p.usCotton],
          ["China Cotton", p.chinaCotton],
          ["India Cotton", p.indiaCotton],
          ["PSF", p.psf],
          ["DTY", p.dty]
        ];

        grid.innerHTML = items.map(([label, d]) => `
          <div class="rm-admin-mini">
            <b>${label}</b>
            <span>${d?.price ?? "—"} / ${d?.changePct ?? "—"}%</span>
          </div>
        `).join("");

        code.value = makeConfigBlock(p);
        result.style.display = "block";
      } catch (err) {
        alert(`추출 실패: ${err.message}`);
      } finally {
        parseBtn.disabled = false;
        parseBtn.textContent = "Gemini로 추출";
      }
    });

    clearBtn.addEventListener("click", () => {
      input.value = "";
      result.style.display = "none";
      code.value = "";
    });

    copyBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(code.value);
      copyBtn.textContent = "복사됨";
      setTimeout(() => copyBtn.textContent = "코드 복사", 1200);
    });
  }

  installStyle();
  createPanel();
})();
