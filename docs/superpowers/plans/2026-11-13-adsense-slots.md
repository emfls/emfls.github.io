# AdSense 슬롯 로컬 패치 실행 계획

> 실행: Codex가 같은 세션에서 직접 수행한다. 사용자가 상세 구현·실행·커밋을 지시했으며 불필요한 재승인 질문은 생략한다.

**Goal:** 최신 main 기준 격리 브랜치에 광고 슬롯 패치와 재현 가능한 안전 검증을 준비한다. 배포와 수익 개선은 별도 상태다.
**Architecture:** 기존 광고 단위 및 보호 보고서를 재사용한다. 표준 HTMLParser로 중첩 DOM의 정확한 닫는 위치를 찾아 원문 바이트를 보존한다. 기본은 dry-run, VERIFIED 보호 입력과 비-main 분기에서만 apply한다.
**Tech Stack:** Python 표준 라이브러리, 기존 pytest, ego(lite).
**Spec:** Vault의 EMFLS_github_io_페이지별_초정밀_광고최적화_상세설계서_20261113.md와 11/13 사용자 지시.

## 범위 및 안전 조정

- 파일: build_column_page.py, scripts/patch_adsense_slots.py, tests/test_patch_adsense_slots.py, 적격 kor/column/*.html, 유틸리티 3종, 캠핑 리포트 1종. PROJECT_HISTORY/TASKS에 결과를 추가한다.
- 최신 main e61550880a45f4f6f570631ad69e8fb670c4d329. 실제 칼럼은 373개다. 수량을 381개로 맞추지 않는다.
- 현행 VERIFIED 보호 보고서와 고정 pin의 WINNER/실험/YMYL/명시 결정 대상은 변경하지 않는다. 누락/UNKNOWN은 fail-closed. 보호 검사/신뢰 pin 변경 없음.
- 기존 계정에서 실제 단위 코드를 읽는다. 일반 display 슬롯 ID를 native in-article/in-feed로 위장하지 않는다. 없는 In-feed 단위는 계정 생성 없이 HOLD한다.
- FlappyDot는 현행 sensitive-page 정책에 따라 광고가 의도적으로 제거됐다. 해당 정책과 회귀를 유지하며 재활성화·refresh를 하지 않는다. 모바일 게임 화면 QA는 광고 없는 기준 확인으로 구분한다.
- 광고는 Advertisement로 명확히 구분하고 결과/버튼을 덮지 않는다. 계산기 결과 DOM 내부는 재계산 시 덮어쓰므로 그 바로 뒤의 독립 슬롯을 사용한다. 광고 반복 push/게임 재시작 refresh 없음.
- ATF min-height 280px, 본문 min-height 250px. 폭100%/box-sizing으로 320/390 검수. min-height만으로 실광고 CLS 보장을 주장하지 않는다.

## 검수 초점

중첩 card 경계, marker 재실행/부분 marker, 보호 입력 결측과 제외, 재계산 시 광고 잔존 및 push 증가 없음, 원문 metadata/GA/기존 광고/게임 안전 정책 보존.

## 순서

- [x] 실패 테스트: 중첩 card 뒤 삽입·멱등·앵커 결측 원문 보존·보호 대상 무변경·템플릿 3번째 section/hero 위치를 확인한다.
- [x] 최소 shared helper와 patch CLI를 구현하고 테스트를 통과시킨다.
- [x] 보호 보고서 VERIFIED를 대조해 dry-run 후 적격 칼럼만 적용하고 재실행 무변경을 검증한다.
- [x] 적격 계산기 결과 바로 뒤 슬롯을 적용한다. 보호된 체크리스트는 별도 diff만 보존한다. 실제 In-feed 코드 없으면 캠핑 native는 HOLD한다.
- [x] 기존 회귀 및 전체 unittest/pytest를 오프라인 임시 OPS 환경에서 실행하고 기준본 실패와 분리한다. Guard 실패는 숨기지 않는다.
- [x] 실제 코드의 안전한 로컬 미리보기에서 칼럼/계산기/게임 320/390 화면·계산 기능·overflow를 확인한다. 광고 요청/GA는 네트워크에서 차단한다.
- [x] 정확한 변경 파일·라인 수·테스트·HOLD 사유를 이력과 Vault에 기록하고 지정 브랜치에 로컬 커밋한다. push/병합/운영 배포는 없다.

실제 결과: 칼럼 159개 적용/130개 보호/84개 앵커 HOLD, 계산기 2개 적용/준비물 WINNER 별도 제안, 기존 In-feed 코드 확보 후 캠핑 1개 적용. FlappyDot 정책 보존. 전체 회귀 FAIL로 출고 HOLD.

고정 pin 대조 뒤 캠핑 In-feed는 검토용 diff만 보존하고 실제 파일은 복원했다. 로컬 최초 렌더 검증은 준비한 후보 화면이며 실제 공개 반영은 아니다.
