// ============================================================
//  8담당 DAILY MARKET BRIEF — 쉽게 수정 가능한 설정 파일
//  매일 아침 이 파일만 업데이트하면 됩니다.
// ============================================================

const CONFIG = {

  // ── 오늘의 헤드라인 (매일 아침 수정) ──────────────────────
  headline: {
    kr: "관세가 확정되고 BTS 성수기가 겹치는 한 주",
    en: "A Week Where Finalized Tariffs Meet the BTS Peak",
  },
  summary: {
    kr: "9개 COP 중 5곳(니카라과·과테말라·코스타리카·엘살바도르·아이티)은 CAFTA-DR·HOPE 특혜로 관세 리스크가 낮은 반면, 베트남은 TRQ 대상에서 빠져 12.5% 고정이 유지됩니다. 동시에 Kohl's·Hollister·Target의 BTS 프로모션이 8월 초 피크에 진입해 리오더 대응력도 함께 필요한 시점입니다.",
    en: "Five of our nine COPs (Nicaragua, Guatemala, Costa Rica, El Salvador, Haiti) carry low tariff risk via CAFTA-DR/HOPE preferences, while Vietnam stays flat at 12.5%. BTS promotions from Kohl's, Hollister and Target are hitting their early-August peak.",
  },
  tags: ["#관세확정", "#CAFTA-DR", "#베트남12.5%", "#BTS성수기", "#아이티"],

  // ── 액션 체크포인트 (매일 수정) ────────────────────────────
  checkpoints: [
    {
      kr: "니카라과·과테말라·코스타리카·엘살바도르向 원단이 CAFTA-DR 적격(원사 전방)인지 재확인",
      en: "Re-verify CAFTA-DR yarn-forward eligibility for Nicaragua/Guatemala/Costa Rica/El Salvador programs",
    },
    {
      kr: "아이티 여유 캐파 확인 — 9개 COP 중 관세 리스크 최저, 하반기 배정 우선순위 후보",
      en: "Check spare Haiti capacity — lowest tariff risk of our nine COPs",
    },
    {
      kr: "베트남向 프로그램 12.5% 고정 기준으로 하반기 코스트 시트 확정",
      en: "Finalize H2 cost sheets for Vietnam-bound programs on the flat 12.5% base",
    },
  ],

  // ── 컨테이너 운임 (주 1회 수동 업데이트) ─────────────────
  freight: {
    value: "$4,297",
    delta: "+1%",
    direction: "up",   // "up" 또는 "down"
    note_kr: "상해 기준 WCI · 주간 변동",
    note_en: "Shanghai WCI · Week-on-week",
    updated: "2026-08-12", // 마지막 업데이트 날짜
  },

  // ── 관세 스냅샷 (정책 변경 시에만 수정) ──────────────────
  tariffs: [
    { country: "Vietnam",    rate: "+12.5%", exempt: false, note_kr: "고정 스태킹, FTA 없음",     note_en: "Flat stacking, no FTA" },
    { country: "Indonesia",  rate: "+10%",   exempt: false, note_kr: "TRQ 대상 (9/1~)",           note_en: "TRQ-eligible (from 9/1)" },
    { country: "Bangladesh", rate: "+10%",   exempt: false, note_kr: "TRQ 대상 (9/1~)",           note_en: "TRQ-eligible (from 9/1)" },
    { country: "Cambodia",   rate: "+10%",   exempt: false, note_kr: "TRQ 대상 (9/1~)",           note_en: "TRQ-eligible (from 9/1)" },
    { country: "Nicaragua",  rate: "0%*",    exempt: true,  note_kr: "CAFTA-DR 적격시 면제",      note_en: "Exempt if CAFTA-DR qualifying" },
    { country: "Guatemala",  rate: "0%*",    exempt: true,  note_kr: "CAFTA-DR 적격시 면제",      note_en: "Exempt if CAFTA-DR qualifying" },
    { country: "Costa Rica", rate: "0%*",    exempt: true,  note_kr: "CAFTA-DR 적격시 면제",      note_en: "Exempt if CAFTA-DR qualifying" },
    { country: "El Salvador",rate: "0%*",    exempt: true,  note_kr: "CAFTA-DR 적격시 면제",      note_en: "Exempt if CAFTA-DR qualifying" },
    { country: "Haiti",      rate: "0%",     exempt: true,  note_kr: "조사 제외 · HOPE/HELP",     note_en: "Excluded · HOPE/HELP" },
  ],
  tariffFootnote: {
    kr: "* 원사 전방 원산지 요건 충족 시",
    en: "* If yarn-forward rules met",
  },

  // ── 주가 티커 심볼 ────────────────────────────────────────
  stocks: [
    { symbol: "KSS",  label: "Kohl's (KSS)" },
    { symbol: "ANF",  label: "Abercrombie & Fitch (ANF)" },
    { symbol: "M",    label: "Macy's (M)" },
  ],

  // ── 원자재 Dashboard (주간 메일 기준 수동 업데이트) ─────────────
  rawMaterials: {
    usCotton: {
      price: 82.60,
      changePct: 2.84,
      unit: "¢/lb",
      source: "Weekly raw material report",
      comment: "미국 원면은 폭염·가뭄 우려와 기술적 매수세로 상승"
    },
    chinaCotton: {
      price: 117.52,
      changePct: -0.34,
      unit: "¢/lb",
      source: "Weekly raw material report",
      comment: "정부 비축면 경매 공급이 상승 심리를 제한"
    },
    indiaCotton: {
      price: 89.53,
      changePct: 1.38,
      unit: "¢/lb",
      source: "Weekly raw material report",
      comment: "신원면 출하 전 재고 부족과 병충해 우려로 강세"
    },
    psf: {
      price: 50.21,
      changePct: -0.70,
      unit: "¢/lb",
      source: "Weekly raw material report",
      comment: "국제 유가 하락 영향으로 약세"
    },
    dty: {
      price: 63.50,
      changePct: 0.00,
      unit: "¢/lb",
      source: "Weekly raw material report",
      comment: "베트남 등 주요 생산지 원사 수요로 보합"
    },
    yarn: {
      india: "재고 부족과 병충해 우려로 강세 유지",
      china: "비축면 경매 지속으로 약보합",
      korea: "휴가 시즌 거래 비활성화와 원화 강세로 하락",
      cafta: "신규 오더 부족으로 보합",
      vietnam: "CVC 카드사 수요 견조 및 재고 타이트로 보합"
    },
    summary: {
      cotton: "미국·인도 상승, 중국 약보합",
      polyester: "PSF 약세, DTY 보합",
      yarn: "지역별 차별화되나 전반적으로 보합권"
    }
  },

  // ── 브랜드 뉴스 (매일 아침 수동 추가 또는 자동 요약 트리거) ─
  news: [
    {
      brand: "kohls",
      brandLabel: "Kohl's",
      category_kr: "프로모",
      category_en: "Promo",
      date: "2026.07.09",
      title_kr: "Tek Gear, $25 이하 BTS 밸류 앵커로 전면 배치",
      title_en: "Tek Gear Steps Up as the Sub-$25 BTS Value Anchor",
      body_kr: "'We are so back' 캠페인에서 Tek Gear 데일리웨어가 $6.99부터 시작하는 밸류 내러티브의 앵커로 명시됐다.",
      body_en: "The 'We Are So Back' campaign names Tek Gear everyday wear (from $6.99) as the anchor of this year's value narrative.",
      source: "MediaPost",
      sourceUrl: "https://www.mediapost.com/publications/article/416395/kohls-goes-all-in-on-value-for-back-to-school.html",
    },
    {
      brand: "kohls",
      brandLabel: "Kohl's",
      category_kr: "라이선스",
      category_en: "Licensing",
      date: "2026.08.12",
      title_kr: "Netflix 'KPop Demon Hunters' 컬렉션 공개",
      title_en: "Netflix's 'KPop Demon Hunters' Collection Unveiled",
      body_kr: "7월 BTS 전략에서 예고된 캐릭터 라이선스 확장이 실제 컬렉션으로 이어졌다.",
      body_en: "The character-licensing expansion previewed in July's BTS strategy has landed as an actual collection.",
      source: "Kohl's Corporate",
      sourceUrl: "https://corporate.kohls.com/",
    },
    {
      brand: "kohls",
      brandLabel: "Kohl's",
      category_kr: "실적일정",
      category_en: "Earnings",
      date: "2026.08.27",
      title_kr: "2분기 실적 8/27 발표 예정 — 컨센서스 EPS $0.33·매출 $33.7억",
      title_en: "Q2 Results Due 8/27 — Consensus EPS $0.33, Revenue $3.37B",
      body_kr: "1분기의 '4년來 최고 comp' 흐름이 2분기에도 이어지는지가 관건.",
      body_en: "The key question is whether Q1's 'best comp in four years' momentum carried into Q2.",
      source: "MarketBeat",
      sourceUrl: "https://www.marketbeat.com/",
    },
    {
      brand: "af",
      brandLabel: "Hollister",
      category_kr: "유통",
      category_en: "Wholesale",
      date: "2026.06.18",
      title_kr: "Hollister, Target 홀세일 채널 확장",
      title_en: "Hollister Expands Into Wholesale via Target",
      body_kr: "직전 분기 Hollister 매출은 보합·comp -2%로 성장 둔화 신호도 함께 존재.",
      body_en: "Its most recent quarter showed flat sales and -2% comps — a deceleration signal alongside the expansion.",
      source: "Retail Dive",
      sourceUrl: "https://www.retaildive.com/news/abercrombie-fitch-co-hollister-target-expanding-us-wholesale/823270/",
    },
    {
      brand: "af",
      brandLabel: "A&F",
      category_kr: "전략",
      category_en: "Strategy",
      date: "2026.08.04",
      title_kr: "중국 사업 파트너 물색 중, 2분기 실적은 8/26 발표",
      title_en: "Seeking Backers for China Business; Q2 Results Due 8/26",
      body_kr: "Bloomberg 보도에 따르면 A&F는 중국 자산에 대한 현지 파트너 영입을 검토 중.",
      body_en: "Per Bloomberg, A&F is reviewing local partnership options for its China business.",
      source: "Bloomberg",
      sourceUrl: "https://www.bloomberg.com/",
    },
    {
      brand: "macys",
      brandLabel: "Macy's",
      category_kr: "실적",
      category_en: "Earnings",
      date: "2026.06.03",
      title_kr: "'Bold New Chapter' 가속 — comp +3.0%, Bloomingdale's +10.2%",
      title_en: "'Bold New Chapter' Accelerates — Comp +3.0%, Bloomingdale's +10.2%",
      body_kr: "Reimagine 200 매장 효과로 Macy's 네임플레이트 comp +1.6%, Bloomingdale's는 7분기 연속 성장.",
      body_en: "Reimagine 200 stores drove +1.6% comp; Bloomingdale's posted its seventh straight quarter of growth.",
      source: "Macy's Inc.",
      sourceUrl: "https://www.macysinc.com/",
    },
    {
      brand: "anntaylor",
      brandLabel: "Ann Taylor",
      category_kr: "캠페인",
      category_en: "Campaign",
      date: "2026.06.01",
      title_kr: "KnitWell 'Buy a Dress, Give a Dress' 캠페인",
      title_en: "KnitWell's 'Buy a Dress, Give a Dress' Campaign",
      body_kr: "Delivering Good와 파트너십으로 정가 드레스 구매 시 1벌을 기부.",
      body_en: "Partnered with Delivering Good — a full-price dress purchase triggers a donated dress.",
      source: "GlobeNewswire",
      sourceUrl: "https://www.globenewswire.com/",
    },
    {
      brand: "talbots",
      brandLabel: "Talbot's",
      category_kr: "매장",
      category_en: "Real Estate",
      date: "2026.03",
      title_kr: "숏펌프(VA) 매장 폐점 — '위기 아닌 로테이션'으로 해석",
      title_en: "Short Pump, VA Store Closed — Called 'Rotation, Not Crisis'",
      body_kr: "KnitWell 전반의 선별 폐점 흐름 안에서 Talbot's도 소수 매장을 정리.",
      body_en: "Talbot's trimmed a handful of stores within KnitWell's broader pattern.",
      source: "Schuckman Realty",
      sourceUrl: "https://www.schuckmanrealty.com/",
    },
  ],

  // ── 경제일정 ──────────────────────────────────────────────
  calendar: [
    { date: "8/13", label_kr: "오늘", label_en: "Today", isToday: true,  title_kr: "창간호 발행",                                   title_en: "Launch edition published",           tag: "Team 8" },
    { date: "8/26", label_kr: "THU", label_en: "THU",   isToday: false, title_kr: "A&F 2분기 실적 발표",                         title_en: "A&F Q2 Earnings Call",               tag: "A&F · Hollister" },
    { date: "8/27", label_kr: "THU", label_en: "THU",   isToday: false, title_kr: "Kohl's 2분기 실적 — 컨센서스 EPS $0.33",     title_en: "Kohl's Q2 Earnings — EPS $0.33",     tag: "Kohl's" },
    { date: "8월하순", label_kr: "예정", label_en: "TBD", isToday: false, title_kr: "Macy's 2분기 실적 발표",                   title_en: "Macy's Q2 Earnings",                 tag: "Macy's" },
    { date: "9/1",  label_kr: "목표", label_en: "Target",isToday: false, title_kr: "TRQ 시행 목표일 — 방글라데시·캄보디아·인도네시아·말레이시아", title_en: "TRQ Implementation Target", tag: "Trade Policy" },
    { date: "9/24", label_kr: "THU", label_en: "THU",   isToday: false, title_kr: "Kohl's 배당 지급일 ($0.125)",               title_en: "Kohl's Dividend Payment ($0.125)",    tag: "Kohl's" },
  ],
};
