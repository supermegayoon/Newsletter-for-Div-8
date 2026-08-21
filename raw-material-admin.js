// File: /raw-material-admin.js
// Admin-only updater: paste weekly email -> Gemini parse -> GitHub auto commit.
// Dashboard reads latest GitHub data through the existing API; Vercel redeploy is NOT required.

(() => {
  const STYLE_ID = "rm-admin-style";
  const PANEL_ID = "rm-admin-panel";

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      .rm-admin{max-width:1180px;margin:28px auto 60px;padding:0 20px}
      .rm-admin-box{background:var(--panel);border:1px dashed var(--line);border-radius:14px;padding:18px}
      .rm-admin-title{font-size:14px;font-weight:800;margin-bottom:4px}
      .rm-admin-note{font-size:10.5px;color:var(--muted);margin-bottom:12px}
      .rm-admin textarea,.rm-admin input{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:9px;background:var(--panel2);color:var(--text);padding:11px;font:12px/1.55 var(--font)}
      .rm-admin textarea{min-height:190px;resize:vertical}
      .rm-admin-row{display:grid;grid-template-columns:180px 1fr;gap:8px;margin-top:8px}
      .rm-admin-actions{display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap}
      .rm-admin button{border:1px solid var(--line);border-radius:8px;padding:8px 12px;background:var(--panel2);color:var(--text);font:700 11px var(--font);cursor:pointer}
      .rm-admin button.primary{background:var(--accent);border-color:var(--accent);color:#fff}
      .rm-admin button:disabled{opacity:.5;cursor:wait}
      .rm-admin-status{font-size:11px;color:var(--muted)}
      .rm-admin-preview{margin-top:14px;display:none;border-top:1px solid var(--line);padding-top:12px}
      .rm-admin-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
      .rm-admin-mini{border:1px solid var(--line);border-radius:8px;padding:9px;background:var(--panel2)}
      .rm-admin-mini b{display:block;font-size:10px}.rm-admin-mini span{font-size:12px}
      @media(max-width:800px){.rm-admin-row{grid-template-columns:1fr}.rm-admin-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(s);
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const host = document.createElement("div");
    host.id = PANEL_ID;
    host.className = "rm-admin";
    host.innerHTML = `
      <div class="rm-admin-box">
        <div class="rm-admin-title">원자재 메일 → Dashboard 자동 반영</div>
        <div class="rm-admin-note">
          메일을 붙여넣고 업데이트하면 Gemini가 숫자를 추출하여 GitHub에 저장합니다.
          완료 후 Dashboard를 새로고침하면 최신 데이터가 바로 표시됩니다. Vercel 재배포는 필요하지 않습니다.
        </div>
        <textarea class="rm-email" placeholder="매주 받는 원자재 가격 동향 메일 전체를 여기에 붙여넣으세요."></textarea>
        <div class="rm-admin-row">
          <input class="rm-pin" type="password" placeholder="관리자 PIN">
          <div class="rm-admin-actions" style="margin-top:0">
            <button class="primary rm-update">Dashboard 자동 업데이트</button>
            <button class="rm-clear">지우기</button>
            <span class="rm-admin-status"></span>
          </div>
        </div>
        <div class="rm-admin-preview"><div class="rm-admin-grid"></div></div>
      </div>
    `;

    document.body.appendChild(host);

    const email=host.querySelector(".rm-email");
    const pin=host.querySelector(".rm-pin");
    const updateBtn=host.querySelector(".rm-update");
    const clearBtn=host.querySelector(".rm-clear");
    const status=host.querySelector(".rm-admin-status");
    const preview=host.querySelector(".rm-admin-preview");
    const grid=host.querySelector(".rm-admin-grid");

    updateBtn.addEventListener("click", async () => {
      if (!email.value.trim()) return alert("원자재 메일을 붙여넣어 주세요.");
      if (!pin.value.trim()) return alert("관리자 PIN을 입력해 주세요.");

      updateBtn.disabled=true;
      status.textContent="Gemini 분석 + GitHub 업데이트 중…";

      try {
        const r=await fetch("/api/raw-material-update",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({emailText:email.value.trim(),pin:pin.value.trim()})
        });
        const j=await r.json();
        if(!r.ok)throw new Error(j.error||`API ${r.status}`);

        const rm=j.parsed?.rawMaterials||{};
        const items=[
          ["U.S. Cotton",rm.usCotton],
          ["China Cotton",rm.chinaCotton],
          ["India Cotton",rm.indiaCotton],
          ["PSF",rm.psf],
          ["DTY",rm.dty]
        ];
        grid.innerHTML=items.map(([name,d])=>`
          <div class="rm-admin-mini"><b>${name}</b><span>${d?.price ?? "—"} / ${d?.changePct ?? "—"}%</span></div>
        `).join("");
        preview.style.display="block";
        status.textContent="완료 ✓ Dashboard를 새로고침하면 최신 값이 표시됩니다.";
      } catch(e) {
        status.textContent=`실패: ${e.message}`;
      } finally {
        updateBtn.disabled=false;
      }
    });

    clearBtn.addEventListener("click",()=>{
      email.value="";pin.value="";preview.style.display="none";status.textContent="";
    });
  }

  installStyle();
  createPanel();
})();
