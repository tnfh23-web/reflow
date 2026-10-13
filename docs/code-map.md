# REFLOW 파일 역할과 기능 흐름

확인일: 2026-10-13. 문법을 몰라도 기능이 어디에서 처리되는지 찾기 위한 문서다. 현재 파일은 `.jsx/.js/.mjs`이며 TypeScript의 `.tsx/.ts`로 만든 프로젝트는 아니다.

## 처음에는 이 다섯 곳만 보면 된다

1. `src/App.jsx`: 어떤 화면을 보여 주고 자료를 언제 불러오는지.
2. 해당 화면 파일: 라이브러리는 `Library.jsx`, 상세는 `Detail.jsx`, 프로젝트는 `Projects.jsx`.
3. `src/api.js`: 화면이 서버에 요청을 보내는 공통 통로.
4. `server/index.js`: 현재 로컬 버전의 로그인·저장·캡처·검색 요청 처리.
5. 공개 서버는 `cloud/worker.mjs` → `cloud/api.mjs` → `cloud/store.mjs`를 거쳐 Supabase에 저장한다. 로컬 버전은 `server/store.js`의 SQLite를 쓴다.

화면 파일은 보이는 내용과 조작을 맡고, 서버 파일은 로그인 확인·실제 저장·이미지 처리를 맡는다. CSS는 모양, 훅은 여러 화면에서 반복되는 동작을 관리한다. 모든 파일을 외울 필요는 없다.

## 현재 실행되는 것과 준비 중인 것

| 부분 | 현재 상태 |
|---|---|
| 로컬 웹앱 | Express/SQLite, 4183 서버. Vite 개발 화면은 4182에서 API를 4183으로 전달한다. |
| 개인 자료·이미지 | 이 PC의 `data/`에 있다. 기존 자료를 클라우드로 자동 이관하지 않았다. |
| Supabase | 무료 새 프로젝트에 DB·RLS·이미지 저장소 기반 적용. Google 제공자 활성화 확인. |
| Google Cloud | 로그인 클라이언트와 기본 계정 식별·이메일·프로필 권한 등록. 공개 앱에서 Google 로그인·개인 복사·메모 저장·프로젝트 생성/추가를 실제 검증했다. |
| Cloudflare 공개 앱 | https://reflow.tnfh23.workers.dev 배포 완료. 승인된 전용 인증 정보는 소스 밖에 보관한다. |
| `cloud/` 코드 | 공개 앱의 인증·저장·API·이미지 업로드·구간 저장·캡처 큐를 실행한다. 로컬 SQLite를 자동 이관하지 않았다. |
| Cloudflare 캡처·클라우드 업로드 | Worker에 연결했다. 실제 Google 계정에서 메모·이미지 업로드·구간 저장·프로젝트 이미지 보존을 확인했다. 2026-10-12 Plus X 원격 캡처의 실제 WebP·Hero 구간·CSS 정보·새로고침 후 저장 유지까지 확인했다. 이전 429 보류를 해소한 이번 실행 결과다. |
| 외부 AI | Gemini 연결 전. 공개 bootstrap ai:false·비주얼 분석 버튼 비활성·의미 검색 요청의 keyword 응답을 확인했다. 공개 서버의 AI 처리와 검색 통합도 남아 있어 키만 넣어 완성되는 상태가 아니다. 정적 이미지에서 모션을 추측하지 않는다. |

## 화면과 공통 동작

| 파일 | 역할 | 연결되는 파일·기능 | 수정할 때 |
|---|---|---|---|
| `src/main.jsx` | React 앱을 시작하고 전역 스타일·PWA를 연결한다. | App, pwa, styles/guide CSS | 앱 시작과 공통 등록 |
| `src/App.jsx` | 화면 이동·자료 상태·로그인 후 복귀·검색·캡처 작업 상태 확인·모달과 공통 서비스 문서 링크를 관리한다. 캡처 상태가 달라질 때 전체 자료를 갱신하고 열린 앱에서 알린다. | 모든 주요 화면, api, Dialogs, notifications, 법적 문서 | 사이드바·헤더·화면 이동·전체 자료 갱신·알림 발생 |
| `src/Library.jsx` | 예시/개인 레퍼런스 목록, 검색·필터·선택·미리보기·비교 진입을 표시한다. | App, UI, motion | 라이브러리 배열과 카드 조작 |
| `src/Detail.jsx` | 큰 캡처와 구간 썸네일, 영역 선택·업로드·분석 패널을 제공한다. | Analysis, api, UI | 상세 이미지·구간 탐색·크롭 |
| `src/Analysis.jsx` | 색·타이포·태그·실제 모션 증거와 메모·분류 편집을 표시한다. | Detail, Compare, api | 분석 설명·메모·태그 편집 |
| `src/Compare.jsx` | 두 레퍼런스의 이미지·색·배치·인터랙션을 나란히 보여 준다. | Analysis, UI | 두 항목 비교 화면 |
| `src/Projects.jsx` | 프로젝트 목록과 섹션별 보드, 순서·이름·항목 편집·스냅샷 탐색을 제공한다. | api, Dialogs, UI | 프로젝트와 보드 조작 |
| `src/Dialogs.jsx` | 로그인·URL 저장·프로젝트 생성/추가·미리보기·설정 모달을 모은다. 공개 로그인에서 실제 연결된 Google만 안내하고 법적 문서를 연결한다. 설정에서 열린 앱의 OS 알림 허용·테스트를 관리한다. | App, api, UI, notifications, terms.html, privacy.html | 입력창·저장 버튼·로그인·알림 설정 |
| `src/UI.jsx` | 버튼·아이콘·브랜드·빈 상태·이미지·태그·모달의 공통 모양과 동작이다. | 대부분의 화면 | 공통 버튼·포커스·모달 닫기 |
| `src/cloud-images.js` | 브라우저에서 업로드 이미지를 WebP로 축소하고 선택 구간을 잘라 multipart로 보낸다. | Detail, cloud/uploads | 클라우드 업로드·크롭 변환 |
| `src/api.js` | `/api` 요청·오류 처리와 날짜·태그 등의 공통 함수를 제공한다. | 화면, 로컬/클라우드 API | 요청 형식·공통 오류 처리 |
| `src/Guide.jsx` | 단계별 사용법과 실제 자료를 바꾸지 않는 연습 화면을 제공한다. | App, UI, motion | 사용법 설명과 연습 |
| `src/Install.jsx` | PWA 설치 가능 여부와 브라우저별 설치 안내를 보여 준다. | pwa, UI | 실제 앱 설치 안내 |
| `src/pwa.js` | 설치 이벤트·설치 상태·서비스 워커 등록·업데이트 대기를 관리한다. | main, Install, App, sw | 설치 이벤트와 업데이트 알림 |
| `src/notifications.js` | 사용자가 켠 경우에만 앱이 열려 있는 동안 캡처·프로젝트 변경을 OS 알림으로 표시한다. 푸시 구독이나 서버 발송은 하지 않는다. | App, Dialogs, public/sw | 알림 허용·내용·기기별 설정 |
| `src/Intro.jsx` | 설명 중심 소개 페이지와 실제 UI 형태의 자동 설치 안내, 공개 서비스 문서 링크를 구성한다. | IntroExtras, use-intro-motion, intro CSS, 법적 문서 | 소개 내용·섹션 배치·설치 그래픽 |
| `src/IntroExtras.jsx` | 자동 캡처·비교·검색 설명 그래픽과 전체 폭 마퀴를 만든다. | Intro, intro-extras CSS | 소개의 반복 그래픽·마퀴 |
| `src/use-intro-motion.js` | 소개 제목의 글자별 등장·본문/이미지 등장 시점·움직임 감소를 관리한다. | Intro, GSAP SplitText/ScrollTrigger | 소개 등장 속도와 재진입 |
| `src/use-auto-hide-header.js` | 아래로 스크롤할 때 헤더를 숨기고 위로 올릴 때 복구한다. | App 헤더 | 헤더 표시 시점 |
| `src/motion.js` | GSAP/ScrollTrigger 등록과 일반 화면의 등장 동작을 공유한다. | 목록·보드·사용법·UI | 공통 모션 설정 |
| `src/smooth-scroll.js` | 페이지와 이미지·패널·모달의 중첩 부드러운 스크롤을 관리한다. 상세 구간 목록은 데스크톱 세로·모바일 가로 방향을 화면 배치대로 판별한다. | App, Detail, Intro, Lenis | 스크롤 루트·이동·터치 대안 |
| `src/styles.css` | 전체 서비스의 레이아웃·공통 UI·반응형·테마를 정의한다. | 모든 서비스 화면 | 화면 크기·배치·공통 디자인 |
| `src/guide.css` | 사용법과 연습 화면 스타일이다. | Guide | 사용법 레이아웃 |
| `src/intro.css` | 소개 본문·설치 그래픽·섹션의 스타일이다. | Intro | 소개 레이아웃 |
| `src/intro-extras.css` | 마퀴와 추가 자동 그래픽의 모양·반복 모션이다. | IntroExtras | 마퀴·설명 그래픽 스타일 |

## 현재 로컬 서버

| 파일 | 역할 | 연결되는 파일·기능 | 수정할 때 |
|---|---|---|---|
| `server/index.js` | Express를 시작하고 로그인·소유권·자료 CRUD·검색·캡처 작업·업로드·크롭을 처리한다. | store, capture, ai, dist | 현재 API 동작과 권한·작업 흐름 |
| `server/store.js` | SQLite 테이블과 자료·프로젝트·미디어 소유자 저장/읽기 함수를 제공한다. | index, capture, seed | 로컬 저장 형식·조회 |
| `server/capture.js` | 주소·접근 대상 검증, 화면 구간별 캡처 합성·실제 CSS/모션 관찰, WebP 저장·이미지 색 추출을 한다. | index, store, capture-ready, capture-tiles, Playwright, Sharp | 캡처 품질·구간·관찰·이미지 처리 |
| `server/seed.js` | 직접 만든 예시 사이트를 촬영해 로컬 샘플 자료로 준비한다. | public/samples, capture, store | 예시 라이브러리 구성 |
| `server/ai.js` | 키가 연결됐을 때만 Gemini에 JSON 분석을 요청한다. | index | 선택 AI 요청 형식·한도 오류 |

## 공개 클라우드 서버

| 파일 | 역할 | 연결되는 파일·기능 | 수정할 때 |
|---|---|---|---|
| `cloud/worker.mjs` | Cloudflare 요청을 API와 정적 앱 제공으로 나누고 직접 만든 공개 예시만 불러온다. | cloud/api, ASSETS | 클라우드 실행 진입점·어댑터 연결 |
| `cloud/api.mjs` | 사용자 인증 후 저장·검색·보드·캡처·업로드 API를 처리하고 미연결 AI 상태를 알린다. | auth, store, 선택 capture/media | 클라우드 API 기능 |
| `cloud/auth.mjs` | Supabase Google PKCE·콜백·로그인·갱신·로그아웃과 암호화 HttpOnly 세션을 처리한다. | config, Supabase Auth | 실제 클라우드 로그인 |
| `cloud/store.mjs` | 사용자 토큰으로 Supabase REST를 호출하고 수정 버전을 검사한다. | cloud/api, Supabase DB | 클라우드 저장·동시 수정 충돌 |
| `cloud/media.mjs` | WebP 프레임 크기를 검사하고 사용자 토큰으로 비공개 이미지 저장/읽기를 처리한다. | Supabase Storage | 이미지 접근·새 파일 저장 |
| `cloud/capture.mjs` | 격리된 원격 브라우저에서 화면 구간별 캡처를 합쳐 전체/섹션 이미지와 실제 CSS 값을 저장한다. 새 원격 캡처의 모션 관찰은 아직 제공하지 않는다. | Browser Run, capture-ready, capture-tiles, network, media | 원격 캡처 품질·제한 |
| `cloud/capture-ready.mjs` | 브라우저 내부에서 로딩 오버레이·화면 안정·이미지/영상 첫 프레임을 기다리고 지연 로딩 스크롤을 수행한다. | cloud/capture, server/capture | 로딩 화면만 저장되는 문제 |
| `cloud/capture-tiles.mjs` | 스크롤 구간이 실제 화면에 나타날 때마다 캡처하고 반복되는 고정 메뉴를 제거한다. | cloud/capture, server/capture | 스크롤 등장 효과로 본문이 비는 문제 |
| `cloud/capture-media.mjs` | 확인된 Vimeo 호스트의 영상 프레임에 필요한 부분만 읽고 리디렉션·DNS·응답 크기를 제한한다. | capture, network | 영상 프레임·미디어 접근 제한 |
| `cloud/network.mjs` | DNS 응답의 비공개·예약 IP를 거부하고 캡처 요청 대상을 검사한다. | capture | 원격 접근 대상 검증 |
| `cloud/jobs.mjs` | Durable Object에서 사용자별 작업 상태·암호화된 단기 작업 토큰·알람·순차 캡처·충돌 재시도를 관리한다. | capture, limits, store | 지속 캡처 큐·중단 처리 |
| `cloud/limits.mjs` | 동시 요청에서도 캡처 횟수·이미지 누적 용량·파일 수를 원자적으로 제한한다. | jobs, media, Durable Object Storage | 무료 운영 한도 |
| `cloud/uploads.mjs` | 파일 크기·WebP·크롭 좌표를 확인해 개인 이미지와 구간을 저장한다. | media, limits, store | 공개 앱 업로드·구간 저장 |
| `cloud/config.mjs` | 프로젝트 주소·공개 키·세션 비밀·앱 origin과 기능 플래그의 형식을 확인한다. | auth, store, media, config 검사 | 연결 설정·기능 활성화 조건 |
| `supabase/migrations/202610110001_reflow.sql` | 개인 자료·프로젝트·공개 예시·작업 테이블과 RLS·미디어 접근 정책을 정의한다. | Supabase DB/Storage | DB 구조·접근 정책. 이미 적용한 SQL을 임의로 재실행하지 않는다. |
| `scripts/check-cloud-config.mjs` | 필수 연결 설정의 누락·형식을 확인한다. 값·비밀키를 출력하지 않는다. | cloud/config | 설정 확인 명령 |
| `scripts/verify-cloud-public.mjs` | 실제 Supabase에서 익명 공개 예시 읽기·개인 자료 접근 차단을 확인한다. | Supabase REST | 익명 권한 확인 |

Worker는 캡처/미디어 어댑터를 연결한다. 공개 예시는 `public/cloud-samples.json`과 `public/examples/`의 자체 자료이며 개인 DB에서 공개 데이터를 자동 추출하지 않는다. 로컬 `server/`와 클라우드 `cloud/`는 별도 저장소다. 캡처는 하루 서비스 전체 10회·계정별 3회, 이미지 저장은 계정별 누적 25MB·서비스 누적 700MB·계정별 하루 파일 30개로 보수적으로 제한한다. 실패한 예약도 계산하며 삭제로 용량을 자동 반환하지 않는다.

## 검증·빌드·앱 파일

| 파일 | 역할 | 연결되는 파일·기능 | 수정할 때 |
|---|---|---|---|
| `tests/capture-ready.test.mjs` | 지연 로딩·로딩 고착·숨겨진 콘텐츠·스크롤 활성화·계속 변하는 텍스트를 실제 Chromium에서 검사한다. | capture-ready, Playwright | 캡처 준비 기준 변경 |
| `tests/capture-tiles.test.mjs` | 화면 밖에서 다시 숨는 요소와 반복되는 고정 메뉴를 실제 Chromium에서 검사한다. | capture-tiles, Playwright, Sharp | 구간별 캡처 동작 변경 |
| `tests/capture-media.test.mjs` | 공개 호스트 리디렉션·Range·초과 응답 차단을 검사한다. | capture-media | 영상 접근 검사 변경 |
| `tests/cloud-auth.test.mjs` | 모의 제공자로 PKCE·세션 보호·로그인·갱신·이메일 확인을 검증한다. | cloud/auth, config, store | 인증 코드 변경 |
| `tests/cloud-database.test.mjs` | PGlite에서 실제 SQL 정책의 소유자·익명 접근·버전·스냅샷 보존을 검증한다. | Supabase migration | DB 정책 변경 |
| `tests/cloud-api.test.mjs` | 테스트 저장소로 저장·검색·보드·동시 수정·Origin·요청 한도를 검증한다. | cloud/api | API 변경 |
| `tests/cloud-limits.test.mjs` | 동시 요청의 전체/개인 캡처 한도·중복 큐·용량·파일 수 제한을 검증한다. | limits | 한도·큐 동시성 변경 |
| `tests/cloud-network.test.mjs` | 내부/예약 IP와 혼합 DNS·빈 응답·DNS 오류의 차단을 검증한다. | network | 접근 대상 검사 변경 |
| `tests/cloud-uploads.test.mjs` | 실제 multipart 형식으로 업로드·크롭·메타데이터 보존·한도 거절을 검증한다. | uploads, media | 업로드·크롭 변경 |
| `tests/cloud-media.test.mjs` | 모의 Storage로 WebP 크기·소유자 차단·토큰·개인 이미지 no-store를 검증한다. | cloud/media | 미디어 어댑터 변경 |
| `tests/open-notifications.test.mjs` | 알림을 명시적으로 켰을 때만 캡처·프로젝트 이벤트가 OS로 전달되고 끄면 중단되는지 검사한다. | src/notifications | 열린 앱 알림 변경 |
| `vite.config.js` | React 앱과 두 정적 문서의 다중 페이지 빌드·개발 API 전달·서비스 워커 캐시 목록과 버전을 구성한다. | src, index/terms/privacy HTML, public/sw, dist | 개발 서버·빌드·PWA 자산 |
| `wrangler.jsonc` | Cloudflare Worker/정적 자산과 기본 기능 플래그를 구성한다. | cloud/worker, dist | 클라우드 배포 구성 |
| `index.html` | React 루트와 웹앱 메타 정보를 제공한다. | src/main | 페이지 시작·메타 정보 |
| `public/sw.js` | 앱 셸을 캐시하고 온라인/오프라인 요청을 처리한다. API·개인 이미지는 캐시하지 않는다. 캐시된 이동 응답을 정규화하고 알림 클릭 시 열린 앱으로 이동한다. | vite.config, pwa, notifications | 오프라인 열람·업데이트·알림 클릭 |
| `src/legal.css` | 공개 문서의 앱형 사이드바·코발트 제목 띠·번호 목차·본문·모바일·다크 스타일을 제공한다. | terms.html, privacy.html, Pretendard | 서비스 문서 디자인·반응형 |
| `src/legal.js` | 문서의 Lenis 스크롤·현재 목차·읽는 위치·헤더 표시·목차 접기·기기 테마를 관리한다. | 문서 HTML, Lenis, legal CSS | 문서 탐색·테마·접근성 |
| `terms.html` | 서비스 범위·외부 콘텐츠 권리·계정·자료 삭제와 문의 방법을 로그인 없이 안내하는 빌드 진입 HTML이다. | legal.js, legal.css, 로그인·설정·소개 링크 | 이용 조건 변경 |
| `privacy.html` | 실제 로그인·저장·캡처와 외부 서비스의 개인정보 처리를 로그인 없이 안내하는 빌드 진입 HTML이다. | legal.js, legal.css, 로그인·설정·소개 링크 | 개인정보 처리 변경 |

| `public/google1737c3c3fb742fb4.html` | Google이 발급한 사이트 소유권 확인 파일이다. 내용과 경로를 유지한다. | Search Console, 정적 배포 | 소유권 확인 방식 변경 |
| `public/robots.txt` | 공개 검색 크롤러에 API·제작 예시 제외와 사이트맵 위치를 안내한다. 접근 권한을 대신하지 않는다. | sitemap, 공개 검색 | 검색 수집 범위 |
| `public/sitemap.xml` | 공개 루트·이용약관·개인정보처리방침의 배포 정규 주소를 검색 엔진에 제공한다. 개인 자료·해시 화면은 넣지 않는다. | robots, Search Console | 공개 검색 페이지 |

`package.json`은 실행 명령과 의존성, `public/manifest.webmanifest`는 앱 이름·아이콘·독립 창 설정이다. `.env.example`과 `cloud/.dev.vars.example`은 필요한 설정 이름의 예시다. 실제 `.env`·`.dev.vars` 값, 비밀번호·토큰·개인 자료를 문서에 옮기지 않는다. `.agents/skills/code-map/`은 문서 갱신 지침과 검사기다.

## 직접 만든 예시 사이트

HTML은 예시 경로와 시작 틀, `sample.js`는 경로별 본문·구간·조작, `sample.css`는 예시별 스타일을 맡는다. 제3자 실제 운영 사이트나 개인 자료가 아니다.

| 파일 | 역할 | 연결되는 파일·기능 | 수정할 때 |
|---|---|---|---|
| `public/samples/form-archive.html` | FORM ARCHIVE 건축 예시의 진입 HTML | sample.js, sample.css | 이 예시의 진입 정보 |
| `public/samples/field-notes.html` | FIELD NOTES 자연·에디토리얼 예시의 진입 HTML | sample.js, sample.css | 이 예시의 진입 정보 |
| `public/samples/pulse-studio.html` | PULSE STUDIO 브랜드 예시의 진입 HTML | sample.js, sample.css | 이 예시의 진입 정보 |
| `public/samples/flow-desk.html` | FLOW DESK 서비스 UI 예시의 진입 HTML | sample.js, sample.css | 이 예시의 진입 정보 |
| `public/samples/frame-atelier.html` | FRAME ATELIER 조형물 예시의 진입 HTML | sample.js, sample.css | 이 예시의 진입 정보 |
| `public/samples/material-index.html` | MATERIAL INDEX 재료·오브제 예시의 진입 HTML | sample.js, sample.css | 이 예시의 진입 정보 |
| `public/samples/along.html` | ALONG 공간 예시의 진입 HTML | sample.js, sample.css | 이 예시의 진입 정보 |
| `public/samples/studio-kin.html` | STUDIO KIN 공간 예시의 진입 HTML | sample.js, sample.css | 이 예시의 진입 정보 |
| `public/samples/sample.js` | 경로에 따라 예시 본문과 구간·관찰할 조작을 구성한다. | 예시 HTML, server/seed | 예시 콘텐츠·구간·동작 |
| `public/samples/sample.css` | 예시별 레이아웃과 스타일을 만든다. | sample.js, 예시 HTML | 예시 디자인 |

## 기능이 돌아가는 순서

### 처음 열기·로그인

`main.jsx`가 `App.jsx`를 표시한다. App이 `api.js`로 `GET /api/bootstrap`을 호출한다. 현재 `server/index.js`가 세션을 확인하고 `store.js`에서 예시·개인 자료·프로젝트를 읽어 돌려준다. App이 받은 값으로 라이브러리를 그린다.

현재 로컬 로그인은 `Dialogs.jsx`의 이메일 입력을 로컬 서버에 보내고, 서버가 로그인 쿠키를 만든다. 로그인 후 App이 자료를 다시 불러오고 사용자가 하려던 저장·추가 동작으로 복귀한다. 공개 앱은 같은 Dialogs에서 실제 연결된 Google 버튼과 이용약관·개인정보처리방침 링크를 표시한다. Worker가 Supabase PKCE를 시작하고 Google 로그인 결과를 `/api/auth/callback`으로 받아 암호화 HttpOnly 쿠키를 만든다. App은 원래 보던 화면과 저장/복사/프로젝트 추가 의도를 복구한다. 문서 HTML/CSS는 정적 자산이라 로그인 전에도 읽을 수 있고 소개·설정·일반 화면 하단에서 연결한다. 로그인 권한 최종 확인과 실계정 검증 상태는 상단 표에서 확인한다.

### URL 저장·캡처

`Dialogs.jsx`가 URL을 `POST /api/references`로 보낸다. 서버는 로그인·중복·주소를 확인하고 URL을 먼저 DB에 저장한다. 캡처 작업이 `server/capture.js`에서 진행되고, 전체 캡처·구간·실제 관찰 정보가 이미지와 DB에 저장된다. App이 `/api/jobs` 상태를 확인해 완료 시 자료를 갱신한다. 캡처 실패해도 URL은 유지하며 상세에서 재시도·직접 업로드할 수 있다. 공개 앱에서는 `cloud/api`가 URL을 저장하고 `cloud/jobs`의 지속 큐에 작업을 넣는다. 알람이 Browser Run을 순차 실행하고 현재 수정 버전을 다시 읽어 캡처를 반영한다. 로컬·공개 캡처는 로딩 오버레이 제거와 화면 안정·미디어 준비를 기다리고 지연 로딩을 활성화한다. 준비가 끝나지 않으면 로딩 화면을 성공으로 저장하지 않는다. `capture-tiles.mjs`는 본문이 화면에 나타난 순간마다 촬영하고 한 장으로 합쳐, 위로 돌아왔을 때 다시 숨는 스크롤 효과를 캡처한다. 구간 목록에서 작은 일반 요소는 제외하되 `header`와 `footer`는 높이에 관계없이 포함하며 구간 제한이 넘을 때는 마지막 구간을 보존한다. 공개 영상은 확인된 Vimeo 호스트에서 최대 4개의 1MB 응답만 읽는다. 새 원격 캡처는 전체/구간·CSS 정보까지 제공하며 스크롤/호버/메뉴/탭 관찰은 로컬 버전과 사전 제작 예시에 있다.

### 메모·태그·검색

`Analysis.jsx`에서 입력한 메모·분류를 API로 보내고 서버가 본인 항목인지 확인한 뒤 저장한다. App의 검색 입력은 `/api/search`를 호출하고 Library가 결과를 표시한다. 현재 키워드 검색은 메모와 수정한 값도 사용한다. 외부 AI·의미 검색은 연결 전이다.

### 구간 선택·프로젝트에 담기

`Detail.jsx`가 캡처에서 선택한 영역을 처리한다. 로컬은 좌표를 서버로 보내고, 공개 앱은 `cloud-images.js`가 선택 구간을 WebP로 변환해 `cloud/uploads.mjs`에 보낸다. 서버는 이미지 크기·좌표·로그인 소유자를 검사한다. `Dialogs.jsx`가 프로젝트와 섹션을 선택해 항목 추가 API를 호출한다. 서버는 자료를 별도 스냅샷으로 보드에 저장하고 `Projects.jsx`가 표시한다. 라이브러리 재캡처나 삭제가 기존 보드 이미지를 자동으로 바꾸지 않는다. 최신 캡처로 교체할 때는 해당 보드 항목을 명시적으로 업데이트한다.

### 설치·소개·오프라인

실제 설치는 `pwa.js`가 브라우저 설치 이벤트를 받고 `Install.jsx`가 안내한다. 소개의 설치 그래픽은 `Intro.jsx`에 있는 자동 설명이며 실제 설치를 실행하지 않는다. `public/sw.js`는 앱 화면과 안내 자산만 캐시한다. 설정에서 알림을 켜면 `notifications.js`가 앱이 열린 동안 캡처 완료·실패와 프로젝트 변경을 OS에 표시한다. `App.jsx`는 `/api/jobs`를 확인하며, 완료된 변경은 자료를 다시 불러온다. 서버 푸시 구독은 없어서 앱을 닫은 뒤 새 알림은 받지 않는다. 오프라인 상태에서 개인 자료 편집·새 캡처·기기 간 동기화를 제공한다고 설명하지 않는다.

## 무엇을 바꾸면 어디를 볼까

| 바꾸려는 것 | 먼저 볼 곳 | 함께 확인할 곳 |
|---|---|---|
| 라이브러리 카드·필터 | src/Library.jsx | App.jsx, styles.css |
| 상세 썸네일 폭·캡처 보기 | src/Detail.jsx | styles.css, smooth-scroll.js |
| 메모·분석 편집 | src/Analysis.jsx | API의 references 수정·검색 |
| 프로젝트 정리 | src/Projects.jsx, Dialogs.jsx | 서버의 projects/items API, 스냅샷 보존 |
| 소개 등장·마퀴 | Intro/IntroExtras, use-intro-motion | intro CSS, reduced-motion |
| 앱 설치 | Install.jsx, pwa.js | manifest, sw.js, vite.config |
| 열린 앱 알림 | notifications.js, App.jsx, Dialogs.jsx | sw.js 알림 클릭, jobs 상태 |
| 로컬 캡처 품질 | server/capture.js | index.js 작업 큐·이미지 처리 |
| 클라우드 로그인·저장 | cloud/auth, store, api, worker | Supabase 설정·RLS, UI 로그인 연결 |

## 문서 갱신 방법

기능 개발·버그 수정·파일 추가/이동/삭제 후 관련 역할표·위 처리 흐름·현재 연결 상태를 검토한다. `AGENTS.md`와 `code-map` 스킬에 이 과정을 연결했다. 설명을 검토한 뒤 `npm run docs:stamp`, 이어서 `npm run docs:check`를 실행한다. 검사기는 역할 설명의 의미까지 판단하지 않는다. 의존성·빌드 결과·실행 QA·개인 데이터·스킬 내부 지원 코드는 기본 검사에서 제외한다.

<!-- code-map-review:start -->
{
  "version": 1,
  "files": {
    "cloud/api.mjs": "00532630132a64aab1407ec0f50d4c66c78379a78cf7a4d873907818548bb367",
    "cloud/auth.mjs": "cf61966037836dabd905875211b33ed2435ccb797f998bf2d644ba58aa13cc0a",
    "cloud/capture-media.mjs": "ed0dabb4cd723e1a140aca44723a62ed65e0de9a6f3e1edc020efa8fefcc5e75",
    "cloud/capture-ready.mjs": "02a195263aeb518e53604d30be73388de6775664223e10c7f92a0cd2290f2c1e",
    "cloud/capture-tiles.mjs": "a012437bd46a8ec2a70ae99b7866639bb5717771e77e782a8908adc43a97605c",
    "cloud/capture.mjs": "0689a3ec113e3ec5f3a9d4803078dfba8af9f37e518846f0061a089ff9cc9fb6",
    "cloud/config.mjs": "93a61142846ddfda4ab7fb4a8b7a50b3512eaad4f80a81d26caa7cc722b06956",
    "cloud/jobs.mjs": "17f363a7cbfe5dab18b6569f6150cc9001c896f00deb228bfe2c2c25a96a3fdb",
    "cloud/limits.mjs": "da87d87ed4fc429f3952528b8eec20847933c4c0fd66f7e311564fffe8a2ef7b",
    "cloud/media.mjs": "0efb6233e73c9e139cb65ac8fe4a6dec616b567e19a0ec6ea4e8acfc6b207da4",
    "cloud/network.mjs": "cdb1ca1af3362601d05a23733a9279d874bcdddfb6ab94fa3c28cf5529bd6fab",
    "cloud/store.mjs": "a208e21cfdf8a1964e62a8b52aa69818f3c2a3f55b161a09994e2acbb769ce4d",
    "cloud/uploads.mjs": "4dca740115c9513b15460d3c43546aeaf9ecfc6ae1b72494ecef81f56c5ae7b7",
    "cloud/worker.mjs": "4267d6f297105f11ae8650f4a74b26294da3072ec684049f6909ac5acf7cb56a",
    "index.html": "63f9d18041a8113df47bda0f3b400eab254e429ea176c3fe7a909e2bfaabebf1",
    "privacy.html": "6fc151721f47e675d88a25daee9749a557d90d736167b91c341443f5ebf11a79",
    "public/google1737c3c3fb742fb4.html": "99de3767dea5c93a1fea64f257fa209327c284fca65bf825f118132a2b6ee318",
    "public/samples/along.html": "0f21ddd56f88ae82ca76a903b59a9d084daaed8f6198abbe42b1bc4c604c078f",
    "public/samples/field-notes.html": "55691728843461cc1d244d1a209005a1697d99f29c797dd7f402265ac6b6cab1",
    "public/samples/flow-desk.html": "832595d6b104a45abe05fcd5b57553967c215d12011bfa3a8ba5dcfa7500cd2d",
    "public/samples/form-archive.html": "c9d833df825118aea834102462888b27693d8b723a20ee7a94a90b28eacf9c21",
    "public/samples/frame-atelier.html": "d47946c49655a896656534e101ae619f9fb5dd7de1bf408a2d46fb55e804e004",
    "public/samples/material-index.html": "1c612363539125ffee0eee7105b8128fa1e24a4e3ba85c86b24f0ccd9cf763cd",
    "public/samples/pulse-studio.html": "ac540efd834f9af293402bf537ecf28f20d23a7b529a1b056c5b4ea734562eee",
    "public/samples/sample.css": "4c61e5526efcfff8dd410aa0a3e6121090c80c45ea16eb58448b16579d48d3f1",
    "public/samples/sample.js": "ea8540213023840b072a41d63deb463ff12001faf4e582489569e96945326f08",
    "public/samples/studio-kin.html": "490412b48a9e980dfdd386e82e5426cb584aa39e7802859df836f85fe65d5460",
    "public/sw.js": "76f57a76251b3a3628f18d0a1c9fa61c7d4aeee7f4fb9f2afceec1a2818ea126",
    "scripts/check-cloud-config.mjs": "1882c15eab9492a53eb26357e20ed41fcdc0961fb309447cd088db387496570b",
    "scripts/verify-cloud-public.mjs": "0cd62f20e9a9b7fcc4e7880af42cb4d62275e6a5d9a103a001e8eaf7683b00f8",
    "server/ai.js": "16cc2cb09c1bc639623f4385322398a54177d874c09ab801aae3ac760a2f7c83",
    "server/capture.js": "9306ecc912805aa9759c20df768d6b07c871e471e54576c3ae440eaa10b12f82",
    "server/index.js": "a41fc30be4a0d996e2a52a9be2c99095e414817ab5d78c65d674dfc217e2ddcb",
    "server/seed.js": "8ef467badf576c17e0dba1f6dd1256e310f11f5c576d96734d3500073d09d535",
    "server/store.js": "c6515af7cb34630eff1541556c75102c19fec32b6501e296f9eeb50825e12386",
    "src/Analysis.jsx": "97161df4903289c815f7c670f018fe2a1509dd4668f60a1f7b0c1501dddfc09f",
    "src/api.js": "1405e82f849acec422434a894e66feae6df9fed727d298fb613b1e5c38613690",
    "src/App.jsx": "f4493a46fd9cfb598bcc2c6ad883fa398547bac792b037aece6c4a3d0a1b9825",
    "src/cloud-images.js": "9b7e7bf07ab6a4c087a8622f965a5e6374167980f286400096c8268a1800ddb7",
    "src/Compare.jsx": "a1501f864e0b920c1608572b23658329e66d92f4d0a9e981d4e1175caff7dce8",
    "src/Detail.jsx": "fa2ad09c35a43380eb158031c946c684157960a6750d9f353f1ea87555762737",
    "src/Dialogs.jsx": "a47a64c59e2dd47a7dca273674255ea2690caab44f035e71b46fcbcabaa979a4",
    "src/guide.css": "68a0b7a0c2f9021618ed487d6dab7494326ab3d40b1ef6e7b72fa744d452ccd7",
    "src/Guide.jsx": "0f85598b4ea2cf443bf7ac8ecece471cf6a3c8db019e7a642cb9d35abc912cda",
    "src/Install.jsx": "95de8adb7caadc5fd0fde1e2888e73e05cfa8adce2f995227816eba554b74b94",
    "src/intro-extras.css": "54a0b89f518ad6d5d90e97cb82a92d08deb6ca2fc5499c402304707ce6aa27ad",
    "src/intro.css": "e8348e5785250c49b85c86378198b36380702fe09d57bb71248e206fca257d2c",
    "src/Intro.jsx": "1626ebf4d96407c71e9cdfb551d7ec0dcca01ae4ee769fcf049d7df7beeb3789",
    "src/IntroExtras.jsx": "4771ac53187800de7edb058b44c98a84612a4b549cb7f01929db3f914c8d91d1",
    "src/legal.css": "6d75e56c2a71e76dceff4bf6a22c51e0aaa813398f506015048eb37dc02ab26a",
    "src/legal.js": "07decae3f41dc6edc62cacc5bf8b205792bc7641bbe5d316c3cfa31b5874ce04",
    "src/Library.jsx": "397c958af73b7c93a5baa2336f77c3f488409edf5f279ce14aaf364698649b20",
    "src/main.jsx": "fbb44ae27368a53fb4aa4197931e2a92a9eaca1aa92364af00d73d0005c49998",
    "src/motion.js": "10bf4d7f00fd6f0fd97201733928e812b3075fa35efa7f41b40162b8a091e55a",
    "src/notifications.js": "72356bf4403b307ada276726c084d6d160bff33172dcd187e93e39d9e03b408c",
    "src/Projects.jsx": "26b655ecbd51e4fcd19e9138689372a276650ab8d07f265e76cfa6c90aa2b5bb",
    "src/pwa.js": "22bc30af10a62e0744561405ae4aab512269b727cb73e5d4730fcb3fd7eebff7",
    "src/smooth-scroll.js": "7012c573d75fc35536829486c7c1238c2d77043bd657fc4130faaab3129410c7",
    "src/styles.css": "d37d4983eff6e4972a3aca5018774bc66cbf10f4fa0e4701a92b906d1cd35cf4",
    "src/UI.jsx": "e95e1d0c468fa05614f5273cd266fda9ca2e12bbaea686ae8860d49f4d455cf3",
    "src/use-auto-hide-header.js": "30771397245aa8553dac049530301c574e7951f41f97c3ac27725aa58724455a",
    "src/use-intro-motion.js": "a55457b7567af906dd9928a793ea53fa8cd01b9f61e68e81da77192c45b8e696",
    "supabase/migrations/202610110001_reflow.sql": "1210b7b4384a749714b2752d1ce3ae7509c59adabc349c49f89d71522d917ca4",
    "terms.html": "05f5251668dba18fd952af0365e03e29e9aab3060699ade420d8870137e1b299",
    "tests/capture-media.test.mjs": "a38f28df54b9c54042673bcf7a11337f1d3571352d046d71a4a5fe2bc8f238e4",
    "tests/capture-ready.test.mjs": "d48969c0cd77980c05f39f5ef572fcf2222710c43d693af7fa564c75d1b66b78",
    "tests/capture-tiles.test.mjs": "22e41181e0c726daa4cefd284e5fb7aa3f2790a0b336fda715a28280b11d1cbf",
    "tests/cloud-api.test.mjs": "3622d7f1b4e1d64edd7548b9f6615d012cfe6e36f742be677a325c8ddb47f7c6",
    "tests/cloud-auth.test.mjs": "70ee87039d3e897d0b4079eb73a845058c026e5c29a297801bc347cec01a1a03",
    "tests/cloud-database.test.mjs": "67251a38fd1d95d558bb5e00aca1d73b962f65711d830ac00f80fed5c87766d6",
    "tests/cloud-limits.test.mjs": "0e604db1fda4ac300e2cfd26b5f1fa9d1d7bc2aea09d6afc4043cab819b86717",
    "tests/cloud-media.test.mjs": "9ed215b3b06f4030f00723b8fdfe591bbd802f6538d784245e791e5058e39935",
    "tests/cloud-network.test.mjs": "6e516dea339e867fc40432b9e37e3eb9df5a74e0509fd44422e63bfb942ad879",
    "tests/cloud-uploads.test.mjs": "a05d91f123593191071e4d6f7439d4650598d13c063888733d19544ccbed1306",
    "tests/open-notifications.test.mjs": "559495d67ecf381edd49d197122731acdc88c42f5ec94d9dcbdc3dddaac62286",
    "vite.config.js": "a03da34bef24c16fff3eba616035fd6b7492688a13856956a4cb5e99822340aa",
    "wrangler.jsonc": "5cf33805ce38e75255cb994bd4db4ad6fc1d5d8dfb78d225267447c9a266cfdd"
  }
}
<!-- code-map-review:end -->

