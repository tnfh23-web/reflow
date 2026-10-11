# 승인 시안 구현 기준

흰색 #FFFFFF 본문, #F6F7F9 사이드바, #191B20 본문, #6B707A 보조, #E5E7EC 경계, #3454F4 선택 색상. Pretendard 14px UI / 32px 제목 / 21px 섹션 제목. 사이드바 208px, 본문 좌우 42px. 미디어 반경 6px, 버튼 6px, 모달 12px. 이미지에 테마용 틴트 없음.

허용 UI: REFLOW, 새 레퍼런스, 라이브러리, 프로젝트, 설정, 라이트·다크, 저장한 장면을 다시 꺼내 보세요., 최근 저장, 전체 레퍼런스, Style, Layout, Interaction, 최신순, 비교 선택, 미리보기, 프로젝트에 추가. 화살표·chevron·새 버튼의 기호를 사용하지 않는다.

구조: Shell/Search, Library/Masonry, ReferenceDetail/SectionRail/Inspector, Compare, ProjectList/Board, Preview, Save/Auth/AddProject/Settings dialogs. 미디어는 새로 생성한 사진을 실제 코드 기반 샘플 사이트에 넣어 실제 캡처한 자료다. 시안 이미지를 앱 UI로 붙이지 않는다.

입력 반응: GSAP 모달 연결·분석 패널, ScrollTrigger 이미지 등장·상세 구간 연결, CSS hover 이미지 탐색, 보드 드래그 이동·키보드 이동 메뉴. 모바일은 하단 내비게이션·두 열 Masonry·비교 세로 배치. reduced-motion에서는 위치 애니메이션과 자동 미리보기 제거.

키 없이 실행되는 서버 저장·로그인은 이 PC의 개발 환경이다. Google / Supabase / Cloudflare는 계정 연결 전 사용 불가이며 실제 연결로 가장하지 않는다. AI 연결 전 자연어 검색은 키워드·사용자 메모 검색으로만 동작한다.
