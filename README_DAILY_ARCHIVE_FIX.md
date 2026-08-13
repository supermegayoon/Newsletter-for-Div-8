# 8담당 DAILY MARKET BRIEF — Daily Edition + Archive Fix

## 핵심 동작
매일 KST 08:00 (UTC 23:00):
1. 전날 `market-current.json`, `news-current.json`, `ai-current.json`을 `archive/YYYY-MM-DD/`에 저장
2. `archive/index.json`에 날짜 누적
3. 오늘 Market snapshot 생성
4. 오늘 News 생성
5. 오늘 News + Market으로 Gemini AI Insight 생성
6. 화면에는 오늘 날짜를 표시
7. data.js의 8/13 `오늘` 하드코딩은 브라우저에서 자동 보정
8. 상단에 ARCHIVE 날짜 링크 표시

## 중요
기존 `data.js`의 고정 Hero/Calendar가 화면을 8/13처럼 보이게 했습니다.
이번 수정에서는 AI가 생성한 headline/summary/tags를 오늘 Hero에 덮어씁니다.

## 업로드
ZIP 내부를 GitHub 저장소 루트에 그대로 업로드하고 동일 파일은 Replace 하세요.

## 첫 테스트
배포 후 Vercel Cron Jobs에서 `/api/daily-update`를 Run 하거나,
CRON_SECRET을 설정하지 않았다면 `/api/daily-update`를 브라우저에서 1회 실행하세요.

정상이라면:
- `issueDateKST`: 오늘 KST 날짜
- archive step: 전날 날짜
- market/news/ai step 모두 오늘 날짜

주의: GitHub 연결 앱은 현재 저장소 읽기는 되지만 쓰기 권한이 403이라 제가 직접 commit하지 못했습니다.
