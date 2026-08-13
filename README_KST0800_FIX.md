# Newsletter-for-Div-8 — KST 08:00 Daily Update Fix

이 ZIP은 기존 프로젝트 전체를 갈아엎는 파일이 아니라 **덮어쓰기/추가용 수정 파일**입니다.

## 변경 파일

- `vercel.json` — Vercel Cron 등록: 매일 23:00 UTC = 08:00 KST
- `api/daily-update.js` — Market → News → Gemini AI 순차 자동 갱신
- `api/market.js` — 브라우저 접속으로 Yahoo 조회하지 않음. Cron만 강제 갱신.
- `api/news.js` — 24시간 기준 제거. Cron이 KST 08:00에 일일 snapshot 생성.
- `api/ai.js` — 24시간 기준 제거. KST 날짜 기준으로 일일 Insight 저장.
- `market-client.js` — 저장된 market snapshot만 표시.
- `news-client.js` — 저장된 daily news만 표시.
- `ai-client.js` — 저장된 daily AI insight만 표시.

## 업로드 방법

1. ZIP을 풉니다.
2. 안에 있는 파일/폴더를 GitHub 저장소 최상단에 그대로 업로드합니다.
3. 같은 이름 파일은 `Replace/Overwrite` 합니다.
4. Vercel이 GitHub push를 감지해 자동 배포될 때까지 기다립니다.
5. Vercel > Project > Settings > Cron Jobs 에 `/api/daily-update` 가 표시되는지 확인합니다.

## 환경변수

기존에 사용 중인 아래 값은 그대로 유지해야 합니다.

- `GITHUB_TOKEN`
- `GEMINI_API_KEY`
- `GITHUB_OWNER` (없어도 기본값 supermegayoon)
- `GITHUB_REPO` (없어도 기본값 Newsletter-for-Div-8)
- `GITHUB_BRANCH` (없어도 기본값 main)
- `GEMINI_MODEL` (없어도 기존 기본값 사용)

선택 권장:
- `CRON_SECRET`

`CRON_SECRET`을 Vercel Environment Variable로 만들면 Cron endpoint를 외부에서 임의 실행하는 것을 막을 수 있습니다.

## 작동 방식

매일 KST 08:00:

1. `/api/daily-update` 실행
2. Yahoo Finance → `market-current.json` 갱신
3. Google News RSS + Gemini → `news-current.json` 갱신
4. 새 Market + 새 News를 Gemini에 전달 → `ai-current.json` 갱신
5. 사용자는 하루 종일 위 저장값만 조회

즉, 전날 오후에 수동 갱신했더라도 다음날 08:00 Cron은 별도로 새 snapshot을 생성합니다.

## 첫 배포 후 즉시 테스트

CRON_SECRET을 설정하지 않았다면 브라우저에서:
`https://newsletter-for-div-8.vercel.app/api/daily-update`

정상 결과:
`"ok": true`

CRON_SECRET을 설정했다면 Vercel Cron의 Run 기능으로 테스트하는 것이 가장 간단합니다.

## 참고

Vercel Cron schedule은 UTC 기준입니다.
`0 23 * * *` = 다음날 `08:00 KST`.
