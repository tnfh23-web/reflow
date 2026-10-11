# REFLOW 공개 서버 연결

공개 주소: https://reflow.tnfh23.workers.dev

## 구성

- 정적 웹앱과 API: Cloudflare Workers Free / workers.dev
- Google 로그인: Supabase Auth의 PKCE, 서버 암호화 HttpOnly 쿠키
- 개인 자료: Supabase PostgreSQL RLS / 비공개 WebP Storage
- URL 캡처: Browser Run과 SQLite Durable Object의 단일 지속 큐
- 공개 예시: 직접 만든 8개 사이트와 공개 자산 manifest
- 로컬 SQLite 자료는 클라우드로 자동 이관하지 않는다.

## 다른 환경에서 배포할 때

1. 무료 Supabase 프로젝트에 migration을 검토해 적용한다. 기존 DB에서는 무작정 재실행하지 않는다.
2. Google OAuth 웹 클라이언트의 callback을 Supabase 제공 callback으로 설정하고 ID·비밀을 Supabase Google 제공자에 등록한다.
3. Supabase Site URL을 앱 HTTPS origin으로, 허용 redirect를 정확한 앱 /api/auth/callback 하나로 설정한다. wildcard를 추가하지 않는다.
4. wrangler.jsonc의 이름·account_id·APP_ORIGIN을 자신의 계정과 주소로 바꾼다. Browser와 SQLite Durable Object binding은 유지한다.
5. SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SESSION_SECRET을 Worker secrets로 등록한다. SESSION_SECRET은 32바이트 난수의 base64url 값이다. 실제 값은 Git·브라우저 번들·문서에 넣지 않는다.
6. npm ci, npm run build, npm run check:cloud, npm run cloud:bundle로 검사하고 Wrangler로 배포한다.
7. 공개 HTTPS에서 Google 로그인·저장·캡처·업로드·크롭·보드·로그아웃을 실제 검증한다.

## 무료 시험 운영 제한

- 앱의 캡처 예약: UTC 날짜 기준 전체 하루 10회, 계정별 3회. 한 번 실패해도 예약 횟수는 계산한다.
- 캡처: 동시에 1개, 브라우저 생성 간격 최소 21초, 브라우저 사용 최대 50초. 목표 사이트와 제한된 이미지/폰트 CDN 및 확인된 Vimeo 프레임 호스트만 허용한다. 영상 응답은 최대 4개×1MB만 읽고 전체 영상을 보관하지 않는다.
- 이미지: 한 파일 최대 12MB, 계정별 누적 25MB, 서비스 누적 700MB, 계정별 UTC 하루 30파일. 전체 캡처·썸네일·구간 각각 한 파일이다.
- 실패한 업로드도 보수적으로 예약 용량에 포함한다. 프로젝트 스냅샷을 보존하므로 라이브러리 삭제로 파일을 자동 삭제하거나 예약 용량을 돌려주지 않는다.
- 제공자 무료 한도는 계정 전체에 공유된다. 앱 제한이 제공자 정책을 대체하지 않는다. 무료 한도 초과 시 실패 처리하며 유료 플랜으로 자동 전환하지 않는다.
- 현재 SMTP·이메일 공개 가입·외부 AI·의미 검색은 연결하지 않았다.
- 새 원격 캡처는 전체/주요 구간과 CSS 정보까지 제공한다. 모션 관찰은 로컬 캡처와 사전 제작 예시에 있다.

## 운영 확인

공개 예시는 개인 라이브러리·계정 정보를 포함하지 않는다. 개인 CRUD와 이미지 읽기는 본인 인증 토큰을 사용한다. 데이터 업데이트 충돌은 재로딩/재시도를 안내한다. 삭제/재캡처는 프로젝트에 이미 담은 스냅샷을 자동 교체하지 않는다.

공식 한도: [Browser Run](https://developers.cloudflare.com/browser-run/limits/), [Durable Objects Free](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Supabase 가격](https://supabase.com/pricing).
