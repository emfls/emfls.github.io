# 2026-09-01 Revenue Growth Automation

## 적용 상태

- 직접 query 증거 검증, 5단계 overlap, 100점 신규 Opportunity 점수 구현
- 점수 70 이상 기본 3개, 85 이상·NO_OVERLAP 추가 슬롯 최대 2개 구현
- 최근 24시간 누적 발행 최대 5개와 활성 발행 실험 최대 20개 구현
- 분석과 콘텐츠 수정을 분리하고 근거 부족 시 `NO_PUBLICATION` 구현
- WINNER, 활성 CTR 실험, 광고·GA4·canonical 보호 launch guard 구현
- 신규 페이지 28일 cohort, win rate와 pattern 상태를 Revenue 대시보드에 연결
- GitHub Actions는 검증 전용이며 예약·쓰기·push를 수행하지 않음

## 현재 실행 결과

- Run: 2026-09-01 14:00 Asia/Seoul
- Direct query research: `INSUFFICIENT_DATA`
- Selected: 0
- Published: 0
- Content launch experiments: 0 / 20
- Rolling 24h publication slots: 5
- Google index candidates: 0, review only

직접 query 조사 스냅샷이 없으므로 0페이지 발행이 정상이다. 수익, 검색량, 순위는 생성하지 않았다.

## 보호 상태

- `EXP-CAMP-NONSAN-CTR-20260901`
- `EXP-CAMP-CHEORWON-CTR-20260901`
- `EXP-CAMP-ULJIN-CTR-20260901`

세 실험은 2026-09-29까지 COOLDOWN이며 신규 콘텐츠 슬롯을 차감하지 않는다. 기존 Revenue WINNER도 변경하지 않는다.

## 기록 위치

프로젝트 루트에 `PROJECT_HISTORY.md`가 없으므로 이 파일을 동일 목적의 권위 있는 구현 기록으로 사용한다. 예약 ID와 최종 테스트 수는 활성화·검증 후 추가한다.

## GitHub Actions 회귀 수정

- 실패 run: `33475375136`
- 원인: checkout이 shallow 상태라 push 직전 SHA가 로컬 object database에 없었지만 launch guard가 해당 SHA와 diff를 시도함
- 수정: push 경로에서 `EVENT_BEFORE` SHA를 depth 1로 fetch한 뒤 guard 실행
- 검증: workflow 테스트 6개, 전체 pytest 660개 통과

## 15:20 KST 직접 query 분석

- Source: Naver Search Advisor, 최근 30일, 업데이트 2026-08-30
- Evidence: `data/naver/search-query-2026-08-30.json`
- TOP 30 상태: `VERIFIED`, 평균순위는 `NOT_AVAILABLE`
- 분석 후보: 10개
- 결과: `IMPROVE_EXISTING` 10개, `NEW_PAGE` 0개, 발행 0개
- 보호: WINNER 및 논산·철원·울진 실험 수정 없음

주요 CTR 기회는 `냐짱 여행준비` 608노출·3클릭·0.5%, `미크로네시아 여행` 124노출·5클릭·4.0%, `경기도 노지캠핑` 67노출·4클릭·6.0%다. 이번 실행에서는 신규 페이지가 아니라 기존 intent 강화 또는 추가 검토 대상으로 유지한다.

## 19:07 KST 예약 회차 수동 실행

- 놓친 19시 예약 회차를 사용자 요청에 따라 2026-09-01 19:07 KST에 수동 실행
- Direct query evidence: `VERIFIED` (Naver Search Advisor 업데이트 2026-08-30)
- Researched: 10
- Selected: 0
- Published: 0
- 판정: 10개 후보 모두 기존 페이지와 동일한 검색 의도이므로 `IMPROVE_EXISTING` 유지
- 보호: WINNER, COOLDOWN, 활성 CTR 실험 및 콘텐츠 본문 수정 없음
- 검증: content launch guard 통과, 전체 pytest 661개 통과

새 외부 데이터나 독립적인 신규 intent가 확인되지 않았으므로 이번 회차의 올바른 결과는 `NO_PUBLICATION`이다.

## 23:02 KST 자동 실행

- Revenue Growth heartbeat `revenue-growth-5` 실행
- 사용 데이터: Naver Search Advisor 2026-08-30 업데이트분, `VERIFIED`
- 새 GA4·AdSense·Google URL 데이터: `NOT_CONNECTED`
- Researched: 10
- Selected: 0
- Published: 0
- 판정: 전 후보 `IMPROVE_EXISTING`, 새 독립 intent 없음
- 보호: WINNER, COOLDOWN, 논산·철원·울진 CTR 실험 및 콘텐츠 본문 수정 없음
- 검증: content launch guard 통과, 전체 pytest 661개 통과

직전 19:07 회차 이후 새 성과 데이터가 없으므로 분석 산출물의 실행시각만 갱신하고 `NO_PUBLICATION`을 유지한다.

## 2026-09-02 External Web Opportunity 전환

- 기존 `revenue-growth-5` heartbeat는 사용자 요청으로 삭제 완료
- 신규 외부 탐색 설계: `docs/superpowers/specs/2026-09-02-external-web-opportunity-automation-design.md`
- 구현 계획: `docs/superpowers/plans/2026-09-02-external-web-opportunity-automation.md`
- 운영 runbook: `docs/growth/external-web-opportunity-runbook.md`
- 외부 후보 검증, 후보 DB, 하루 3페이지 제한, launch manifest 연결을 별도 worktree에서 테스트 우선으로 구현
- 신규 cron은 검증된 구현이 main에 반영된 뒤 2시간 주기로 활성화한다.

## 2026-09-02 대화형 진행상황 보고 전환

- 자동화 ID: `external-web-opportunity-discovery`
- 실행 주기: 2시간
- 상태: `ACTIVE`
- 사용자가 실행 진행상황을 현재 대화에서 확인할 수 있도록 독립 cron에서 현재 스레드에 연결된 heartbeat 방식으로 전환
- 매 실행 시 시작 단계와 완료 요약을 한국어로 보고
- 완료 보고 항목: 외부 후보 수, 소스별 발견 수, 중복 거절 수, 조사·Brief·READY 상태, 오늘 발행 수(`X / 3`), TOP 기회, 테스트·push·GitHub Actions 상태
- 데이터나 외부 출처가 부족해 fail-closed로 종료하는 경우에도 이유를 현재 대화에 보고

## 2026-09-02 15:03 KST 외부 탐색 자동 실행

- Discovery origin: `EXTERNAL_WEB`
- 발견 후보: 10개 (`Google 3`, `Naver 5`, `Other websites 2`)
- 기존 site audit: 19,066페이지 기준 intent 중복 검사
- 상태: `BRIEF_READY 10`, `READY_TO_LAUNCH 0`
- 오늘 발행: `0 / 3`, launch manifest는 `NO_PUBLICATION`
- 상위 후보: 국가자격시험 모바일 신분증 확인(78.0), 항공권 예약번호 확인(76.5), 네이버 수집·색인 진단(76.0)
- 미발행 사유: 공식 출처 검증 또는 Quality Feasibility 75점 기준 미충족. 건강기능식품 확인 후보는 기존 건강 클러스터와 `MEDIUM_OVERLAP`이라 별도 URL 보류
- YMYL 후보는 공식 출처·한계·고지 요건을 fail-closed로 적용
- 보호: WINNER 및 논산·철원·울진 COOLDOWN 수정 없음
- 검증: content launch guard `PASS`, 전체 pytest `677 passed`

## 2026-09-02 21:07 KST 외부 탐색 자동 실행

- Discovery origin: `EXTERNAL_WEB`
- 신규 발견 후보: 10개 (`Google 3`, `Naver 0`, `Other websites 7`)
- Naver 직접 검색은 접근 제한 상태라 수요 신호를 추측하지 않음
- 신규 후보군: 학원 환불, 예술활동증명, 주민조례청구, 재개발 준공인가, 저작권 법정허락, 정수기 렌탈 피해, 산지전용허가, 미용사 면허, 리콜상품 대응, 외국인 신청내역 조회
- 기존 site audit 19,066페이지 제목·H1 기준 명시적 중복 없음
- 누적 상태: `RESEARCHING 20`, `BRIEF_READY 20`, `READY_TO_LAUNCH 0`
- 점수 통과·Brief 미완성: 학원 환불(80.5/77.5), 저작권 법정허락(78.0/77.0), 리콜상품 대응(77.0/76.0)
- 오늘 발행: `0 / 3`, launch manifest는 `NO_PUBLICATION`
- 보호: WINNER 및 논산·철원·울진 COOLDOWN 수정 없음
- 검증: content launch guard `PASS`, 전체 pytest `677 passed`

## 2026-09-02 19:05 KST 외부 탐색 자동 실행

- Discovery origin: `EXTERNAL_WEB`
- 신규 발견 후보: 10개 (`Google 3`, `Naver 0`, `Other websites 7`)
- Naver 검색 결과 직접 접근 제한이 계속되어 관련 수요를 추측하지 않음
- 신규 후보군: WebRTC IP 유출, canvas/font fingerprint, Client Hints, GPC/DNT, 브라우저 권한, TLS, HTTP/3, fingerprint 비교, privacy browser 비교
- 기존 site audit 19,066페이지와 비교한 결과 명시적 제목·H1 중복은 발견되지 않음
- 누적 상태: `RESEARCHING 10`, `BRIEF_READY 20`, `READY_TO_LAUNCH 0`
- 오늘 발행: `0 / 3`, launch manifest는 `NO_PUBLICATION`
- 미발행 사유: 신규 후보의 공식 기술 문서 검증과 완성 Content Brief가 부족함
- 보호: WINNER 및 논산·철원·울진 COOLDOWN 수정 없음
- 검증: content launch guard `PASS`, 전체 pytest `677 passed`

## 2026-09-02 17:03 KST 외부 탐색 자동 실행

- Discovery origin: `EXTERNAL_WEB`
- 신규 발견 후보: 10개 (`Google 4`, `Naver 0`, `Other websites 6`)
- Naver 검색 결과 직접 접근은 robots 제한으로 차단되어 숫자나 수요를 추측하지 않음
- 기존 site audit: 19,066페이지 기준 intent 중복 검사
- 누적 상태: `BRIEF_READY 20`, `READY_TO_LAUNCH 0`
- 오늘 발행: `0 / 3`, launch manifest는 `NO_PUBLICATION`
- 상위 신규 후보: 자동차 여행 연료비·통행료 분담 계산기(80.0), 페인트 필요량 계산기(77.0), 신발 사이즈 변환기(76.5)
- 미발행 사유: 공식·표준 출처 및 Quality Feasibility 75점 기준 미충족
- 보호: WINNER 및 논산·철원·울진 COOLDOWN 수정 없음
- 검증: content launch guard `PASS`, 전체 pytest `677 passed`

## 2026-09-06 19:00 KST 외부 기회 첫 신규 도구 발행

- 발행 후보: `EXT-20260902-014` 자동차 여행 연료비·통행료 분담 계산기
- 신규 URL: `/kor/util/road-trip-cost-calculator/`
- 근거 상태: `OBSERVED_SEARCH_SIGNAL` (정확한 검색량은 주장하지 않음)
- 중복 판정: `NO_OVERLAP`; 여행·캠핑 클러스터의 독립적인 계산형 intent
- Opportunity: `84 / 100`; Quality Feasibility: `91 / 100`
- 공식 확인 출처: 오피넷, 한국도로공사 (2026-09-06 확인)
- 추가 가치: 왕복 거리, 유류비, 통행료, 주차비, 총비용과 1인당 분담액을 한 번에 계산
- 실험: `EXP-CONTENT-20260906-01`, 상태 `OBSERVING`
- 관찰 종료 및 COOLDOWN: 2026-10-04
- 신규 페이지 baseline: Naver·Google·GA4 `NOT_AVAILABLE`, AdSense URL 수익 `NOT_CONNECTED`; 임의 수치 없음
- 당일 발행: `1 / 3`; 품질 기준을 통과한 다른 후보가 없어 추가 발행하지 않음
- 보호: 기존 WINNER 및 논산·철원·울진 CTR 실험 수정 없음
- 반복 방지: 발행 실험에 등록된 `candidateId`는 다음 예약 실행의 launch selector에서 자동 제외
- CI 안전성: 같은 날의 `LAUNCHED` manifest를 기존 daily 분석이 덮어쓰지 않도록 보호하고, 재생성된 site audit에서는 현재 manifest URL 자체를 기존 중복 집합에서 제외
- 검증: launch guard `PASS`, site audit 파서 오류 `0`, unittest `577`, pytest `681`, JavaScript 도구 테스트 `6` 모두 통과

## 2026-09-06 21:17 KST 외부 탐색 자동 실행

- Discovery origin: `EXTERNAL_WEB`
- 신규 발견 후보: 10개 (`Google 1`, `Naver 8`, `Other websites 1`)
- 수요 상태: 모두 `OBSERVED_SEARCH_SIGNAL`; 정확한 검색량 숫자는 생성하지 않음
- 신규 후보군: 호텔 표시가격 차이, 항공권 예약 미연동, 예약 부분취소, 해외 식당 예약 준비, 호텔 포인트 미지급, 패키지여행 변경·취소, 여행정보 오류 신고, 해외 감염병 사전 확인, Merchant Center 인기제품 해석
- 기존 site audit 제목·description 기준 명시적 동일 intent 없음; 항공권 미연동은 기존 예약번호 후보와 `LOW_OVERLAP`, 해외 감염병 후보는 여행 클러스터와 `MEDIUM_OVERLAP`으로 보수 판정
- 누적 상태: `RESEARCHING 30`, `BRIEF_READY 19`, `READY_TO_LAUNCH 0`
- 신규 TOP 후보: 호텔 검색가격 차이 확인표 `74.5 / 66.5`; 다음 행동은 추가 공식 판매사 자료와 세금·수수료 조건 비교 후 Brief 완성
- 미발행 사유: 신규 10개 모두 Quality Feasibility 75 미만 또는 Brief 미완성. 서비스 종속 질문을 얇은 페이지로 발행하지 않음
- 오늘 발행: `1 / 3`; 19:00 발행한 자동차 여행 비용 계산기 외 추가 발행 없음
- 보호: 기존 WINNER 및 논산·철원·울진 COOLDOWN 수정 없음

## 2026-09-07 15:26 KST 외부 탐색 자동 실행

- Discovery origin: `EXTERNAL_WEB`
- 신규 발견 후보: 10개 (`Google 5`, `Naver 0`, `Other websites 5`)
- Naver에서 캠핑 안전·환불 관련 표현을 탐색했으나 별도의 검증 가능한 신규 근거를 확보하지 못해 0으로 기록하고 검색량을 추측하지 않음
- 신규 후보군: 국립공원 야영장 환불 계산, 추첨 신청, 무공해 영지, 기상특보 취소, 등록 캠핑장 확인, CO 경보기, 방염 텐트, 부탄가스 불판, 전기 릴선, 아이 동반 설치 안전
- 기존 site audit 19,066페이지와 후보 DB에서 직접 SAME_INTENT 없음; 아이 동반 설치 안전은 기존 `/kor/util/camping-packing-checklist/`와 `LOW_OVERLAP`
- TOP 점수: 국립공원 야영장 취소 환불 예상액 계산기 Opportunity `81.0`, Quality `75.05`; 완성 Brief와 정책 예외 검증 부족으로 `RESEARCHING`
- 누적 상태: `RESEARCHING 118`, `BRIEF_READY 19`, `READY_TO_LAUNCH 0`, 전체 `SAME_INTENT 2`
- 오늘 발행: `0 / 3`; launch manifest는 `NO_PUBLICATION`
- 다음 행동: 국립공원 최신 환불 규정·기상특보 예외·날짜 경계 테스트를 교차 검증하고 캠핑 WINNER로 연결되는 독립 계산기 Brief를 우선 완성
- 보호: 기존 WINNER 및 논산·철원·울진 COOLDOWN 수정 없음

## 2026-09-07 13:25 KST 외부 탐색 자동 실행

- Discovery origin: `EXTERNAL_WEB`
- 신규 발견 후보: 10개 (`Google 5`, `Naver 0`, `Other websites 5`)
- Naver에서 유니코드·URL 인코딩 관련 표현을 탐색했으나 별도의 검증 가능한 신규 근거를 확보하지 못해 0으로 기록하고 검색량을 추측하지 않음
- 신규 후보군: URI 퍼센트 인코딩, URI 파서, URI 정규화, URI Template, IRI 변환, UUID 판독, UUIDv7 시간 해석, UUID 검증, Unicode 정규화, 혼동문자 점검
- 기존 site audit 19,066페이지와 이전 후보 DB에서 이번 10개 intent의 직접 중복 없음
- 신규 후보 공통 점수: Opportunity `77.35`, Quality Feasibility `75.5`; 점수는 통과했지만 독립 수요·테스트 벡터·완성 Brief가 부족해 `RESEARCHING` 유지
- 누적 상태: `RESEARCHING 108`, `BRIEF_READY 19`, `READY_TO_LAUNCH 0`, 전체 `SAME_INTENT 2`
- 오늘 발행: `0 / 3`; launch manifest는 `NO_PUBLICATION`
- TOP 신규 후보: URI 예약문자 구분 퍼센트 인코더; 다음 행동은 기존 dataconvert·코드 도구 기능 overlap과 URI 하위 후보 통합 가능성을 검증한 뒤 한 개의 완결형 Brief만 검토
- 보호: 기존 WINNER 및 논산·철원·울진 COOLDOWN 수정 없음

## 2026-09-07 11:24 KST 외부 탐색 자동 실행

- Discovery origin: `EXTERNAL_WEB`
- 처리 후보: 11개 (`Google 6`, `Naver 0`, `Other websites 5`): 신규 intent 10개 + 이전 후보 정밀 중복 교정 1개
- Naver 접근성 체크리스트 탐색에서 별도의 검증 가능한 신규 근거를 확보하지 못해 0으로 기록하고 검색량을 추측하지 않음
- 신규 후보군: alt 텍스트 결정, 터치 타깃 크기, 텍스트 간격, accessible name, 200% 확대, 자동 움직임 정지, reduced motion, HTML 언어 태그, 헤딩 구조, 키보드 포커스 순서
- 정밀 중복 교정: `EXT-20260907-101` CSS 색상 형식 변환기는 기존 `/kor/util/color-extractor/`가 HEX·RGB·HSL 변환 intent를 충족하므로 `SAME_INTENT / DO_NOT_CREATE`
- 누적 상태: `RESEARCHING 98`, `BRIEF_READY 19`, `READY_TO_LAUNCH 0`, 전체 `SAME_INTENT 2`
- 오늘 발행: `0 / 3`; launch manifest는 `NO_PUBLICATION`
- 미발행 사유: 신규 접근성 후보는 자동 판정 한계, 실제 사용자 테스트 범위와 완성 Content Brief가 아직 부족함
- TOP 신규 후보: 이미지 alt 텍스트 결정 도우미; 다음 행동은 한국어 이미지 유형 사례와 기존 이미지 도구 overlap을 검증하고 재현 가능한 결정 트리 Brief 작성
- 보호: 기존 WINNER 및 논산·철원·울진 COOLDOWN 수정 없음

## 2026-09-07 09:23 KST 외부 탐색 자동 실행

- Discovery origin: `EXTERNAL_WEB`
- 신규 발견 후보: 10개 (`Google 5`, `Naver 0`, `Other websites 5`)
- Naver도 변환기·계산기 표현을 탐색했으나 별도의 검증 가능한 신규 근거를 확보하지 못해 0으로 기록하고 검색량을 추측하지 않음
- 신규 후보군: CSS 색상 형식 변환, WCAG 텍스트 명암비, 포커스 표시 점검, CSS specificity, CSS clamp, 박스 모델 계산, object-fit 미리보기, 이미지 비율·크롭, srcset 생성, 개발자도구 단축키
- 기존 site audit 19,066페이지와 이전 후보 DB의 제목·intent 기준 이번 10개 직접 중복 없음
- 신규 후보 공통 점수: Opportunity `78.0`, Quality Feasibility `76.85`; 점수는 통과했지만 완성 Content Brief가 없어 `RESEARCHING` 유지
- 누적 상태: `RESEARCHING 89`, `BRIEF_READY 19`, `READY_TO_LAUNCH 0`, 전체 `SAME_INTENT 1`
- 오늘 발행: `0 / 3`; launch manifest는 `NO_PUBLICATION`
- TOP 신규 후보: CSS 색상 형식 변환기; 다음 행동은 기존 색상·변환 도구와의 본문 의미 중복을 정밀 검사하고 브라우저 호환성·테스트 벡터·내부링크를 갖춘 Brief로 한 후보만 승격 검토
- 보호: 기존 WINNER 및 논산·철원·울진 COOLDOWN 수정 없음

## 2026-09-07 07:22 KST 외부 탐색 자동 실행

- Discovery origin: `EXTERNAL_WEB`
- 신규 발견 후보: 10개 (`Google 5`, `Naver 0`, `Other websites 5`)
- Naver에서도 자동차 유지·검사 관련 표현을 탐색했으나 별도의 검증 가능한 신규 근거를 확보하지 못해 0으로 기록하고 검색량을 추측하지 않음
- 신규 후보군: 자동차검사 수수료, 지연 과태료 계산, 수수료 감면, 검사기간 알림, 자동차 등록비용 조회, 중고차 실매물 확인, 평균 매매금액 해석, 자동차 관리사업자 조회, 기계식주차장 검사, 검사 전 셀프 점검
- 기존 site audit 19,066페이지와 이전 후보 DB에서 이번 10개 intent의 직접 중복은 발견되지 않음
- 누적 상태: `RESEARCHING 79`, `BRIEF_READY 19`, `READY_TO_LAUNCH 0`, 전체 `SAME_INTENT 1`
- 오늘 발행: `0 / 3`; launch manifest는 `NO_PUBLICATION`
- 미발행 사유: 공식 수수료·과태료·검사 기준의 변경 가능성, 추가 수요 근거와 완성 Content Brief 부족
- TOP 신규 후보: 자동차검사 지연 과태료 계산기; 다음 행동은 최신 법령·공식 계산 기준과 날짜 경계 사례를 교차 검증하고 테스트 가능한 계산 Brief로 승격 여부 판단
- 보호: 기존 WINNER 및 논산·철원·울진 COOLDOWN 수정 없음

## 2026-09-07 05:20 KST 외부 탐색 자동 실행

- Discovery origin: `EXTERNAL_WEB`
- 신규 발견 후보: 10개 (`Google 5`, `Naver 0`, `Other websites 5`)
- Naver도 탐색했지만 새롭고 검증 가능한 고유 신호를 확보하지 못해 0으로 기록했으며 검색량을 추측하지 않음
- 신규 후보군: 민원 처리기간, 온라인 세대주 변경 확인, 자동차 종합검사, 도난 말소차 재등록, 지역 통합돌봄, 사회보장급여 변경, 소액사건 인지대·송달료, 공유재산 대부료, 건설일용근로자 휴업수당, 저작권 법정허락
- 기존 site audit에서 10개 표현의 명시적 동일 페이지는 없었으나, 저작권 법정허락은 기존 외부 후보 DB와 `SAME_INTENT`여서 `DO_NOT_CREATE` 처리
- 누적 상태: `RESEARCHING 69`, `BRIEF_READY 19`, `READY_TO_LAUNCH 0`, `SAME_INTENT 1`
- 오늘 발행: `0 / 3`; launch manifest는 `NO_PUBLICATION`
- 미발행 사유: 행정·법률·복지 YMYL 후보로서 최신 공식 기준 교차검증, 계산식 유지관리 방안 및 완성 Brief가 부족함
- TOP 신규 후보: 자동차 종합검사 대상·주기 확인표; 다음 행동은 공식 검사 조회 경로와 차량별 적용 조건을 추가 검증한 뒤 독립 도구 가치 평가
- 보호: 기존 WINNER 및 논산·철원·울진 COOLDOWN 수정 없음

## 2026-09-07 03:20 KST 외부 탐색 자동 실행

- Discovery origin: `EXTERNAL_WEB`
- 신규 발견 후보: 10개 (`Google 2`, `Naver 0`, `Other websites 8`)
- Naver도 탐색했지만 새롭고 검증 가능한 고유 신호를 확보하지 못해 0으로 기록했으며 검색량을 추측하지 않음
- 신규 후보군: 무료체험 자동결제, 렌터카 인수·반납 증빙, 반려동물 멤버십 해지, 소비자 피해구제 증빙, 미성년자 피해구제, 내용증명 준비, 해외직구 합배송 통관, SNS 해외쇼핑몰 사기 점검, 택배 피해 증빙, 체육시설 장기이용권 해지
- 한국소비자원 공식 자료에서 문제 신호를 확인했으며 정확한 검색량은 모두 `OBSERVED_SEARCH_SIGNAL`로만 기록
- 기존 site audit 제목·description 검색에서 명시적 동일 intent 0건; 추후 본문 의미 중복과 최신 기준을 추가 검증
- 누적 상태: `RESEARCHING 60`, `BRIEF_READY 19`, `READY_TO_LAUNCH 0`
- 오늘 발행: `0 / 3`; launch manifest는 `NO_PUBLICATION`
- 미발행 사유: 소비자 분쟁·환급 관련 YMYL 후보로서 추가 공식 근거, 최신 기준, 한계 고지 및 완성 Brief가 필요함
- 다음 행동: 무료체험 자동결제와 렌터카 증빙 후보부터 반복 질문 신호와 최신 공식 기준을 교차 확인하고, 독립 가치가 입증된 후보 하나만 Brief 승격 검토
- 보호: 기존 WINNER 및 논산·철원·울진 COOLDOWN 수정 없음

## 2026-09-07 01:19 KST 외부 탐색 자동 실행

- Discovery origin: `EXTERNAL_WEB`
- 신규 발견 후보: 10개 (`Google 7`, `Naver 0`, `Other websites 3`)
- Naver 탐색 결과는 직전 두 회차 후보와 중복되어 신규 후보 0; 검색량 추측 없음
- 신규 후보군: 항공 배출량 미표시, 비행운 영향, 항공사 검색 누락, 호텔 맞춤가격, 호텔 평균가격 기준, 환경 인증, AI 호텔 예약 지원조건, 해외 여권분실·도난, 신속해외송금
- 기존 site audit 제목·description 기준 명시적 동일 intent 없음; 여권분실·도난 후보는 기존 여행 안전 콘텐츠와 `MEDIUM_OVERLAP`
- 누적 상태: `RESEARCHING 50`, `BRIEF_READY 19`, `READY_TO_LAUNCH 0`
- 신규 TOP 후보군: NO_OVERLAP 후보 `70.0 / 65.5`; 다음 행동은 별도 페이지가 필요한 반복 수요와 추가 출처를 확보한 뒤 가장 강한 후보 하나만 Brief로 승격
- 미발행 사유: 모든 신규 후보가 Quality Feasibility 75 미만이며 Brief 미완성
- 오늘 발행: `0 / 3`; 새 날짜의 슬롯은 열려 있으나 억지 발행하지 않음
- 보호: 기존 WINNER 및 논산·철원·울진 COOLDOWN 수정 없음

## 2026-09-06 23:18 KST 외부 탐색 자동 실행

- Discovery origin: `EXTERNAL_WEB`
- 신규 발견 후보: 10개 (`Google 8`, `Naver 0`, `Other websites 2`)
- Naver는 탐색했으나 직전 회차와 겹치지 않는 새 근거를 확보하지 못해 0으로 기록; 수요 숫자 추측 없음
- 신규 후보군: 추천/최저가 항공편 차이, 자가 환승 위험, 분리 발권 다구간, 수하물 포함 총가격, 검색 통화·위치, 가격 추적 알림, 호텔 특가 배지, 호텔 등급·평점, 해외 테러 행동, 해외 연락두절 신고
- 기존 site audit 제목·description 기준 동일 intent 없음; 해외 테러 행동 후보는 기존 여행 안전 콘텐츠와 `MEDIUM_OVERLAP`으로 보수 판정
- 누적 상태: `RESEARCHING 40`, `BRIEF_READY 19`, `READY_TO_LAUNCH 0`
- 신규 TOP 후보군: 비안전 여행 후보 각 `72.25 / 67.0`; 다음 행동은 실제 반복 질문을 추가 확보하고 독립 표·도구 차별성을 검증해 하나만 Brief로 승격
- 미발행 사유: 신규 후보 모두 Quality Feasibility 75 미만이고 Brief 미완성. 유사한 Google 여행 기능 설명을 여러 얇은 페이지로 발행하지 않음
- 오늘 발행: `1 / 3`; 이번 회차 추가 발행 없음
- 보호: 기존 WINNER 및 논산·철원·울진 COOLDOWN 수정 없음
## 2026-09-07 19:26 KST 외부 탐색 자동 실행

- Discovery origin: `EXTERNAL_WEB`
- 신규 발견 후보: 10개 (`Google 6`, `Naver 0`, `Other websites 4`)
- 국립공원공단 예약·환불정책, 시설 안내와 한국소비자원 캠핑 안전 자료에서 수요 신호를 확인했으며 정확한 검색량은 모두 `OBSERVED_SEARCH_SIGNAL`로만 기록
- 신규 후보군: 야영장 전기 옵션, 대기예약 전환, 예약 부도 제한, 반려견 동반 조건, 감면율 예상요금, 차량·전기 추가요금, 입퇴실 시간, 휴장 공지, 텐트 비상구·소화기 배치, 해외구매 가스용품 KC 확인
- 기존 site audit 19,066페이지 및 후보 DB의 URL·제목·intent를 비교했고 직접 동일 intent는 발견되지 않음. 준비물·버너 추천과 가까운 두 후보는 `LOW_OVERLAP`으로 보수 판정
- `EXT-20260907-131` 국립공원 야영장 취소 환불 예상액 계산기는 공식 근거 2개, 핵심 사실, 표·계산기·FAQ 구성을 확보해 `BRIEF_READY`로 승격
- 환불 계산기 후보는 내부링크 계획과 기상·공단 귀책 예외의 날짜 경계 테스트가 남아 `READY_TO_LAUNCH`로 올리지 않고 발행 차단
- 누적 상태: `RESEARCHING 127`, `BRIEF_READY 20`, `READY_TO_LAUNCH 0`, 전체 `SAME_INTENT 2`
- 오늘 발행: `0 / 3`; launch manifest는 `NO_PUBLICATION`
- TOP 신규 후보: 국립공원 야영장 차량·전기 추가요금 계산기 `83.3 / 77.1`; 다음 행동은 최신 요금표 적용 범위와 시설별 예외를 교차 검증한 뒤 환불 계산기와 우선순위를 비교
- Naver에서는 이번 회차에 독립적으로 검증 가능한 신규 근거를 확보하지 못해 0으로 기록하고 검색량을 추측하지 않음
- 보호: 기존 WINNER 및 논산·철원·울진 COOLDOWN 수정 없음
## 2026-09-07 21:27 KST 외부 탐색 자동 실행

- Discovery origin: `EXTERNAL_WEB`
- 신규 발견 후보: 10개 (`Google 5`, `Naver 2`, `Other websites 3`)
- 신규 후보군: 초과시간 요금, 샤워장 운영, 숯불·장작 허용, 차박 허용 영지, 캠핑카 전용영지, 기준인원 초과료, 무장애 영지, 주중·주말·성수기 판정, 그린포인트 결제, 특화야영장 구비물품
- 국립공원공단의 최신 요금표·이용정책·시설 안내를 근거로 사용했으며 정확한 검색량은 `OBSERVED_SEARCH_SIGNAL`로만 기록
- 기존 19,066페이지 및 후보 DB와 intent를 비교했고 일반 오토캠핑·준비물 페이지에 가까운 후보는 `LOW_OVERLAP`으로 보수 판정
- `EXT-20260907-146` 차량·전기 추가요금 계산기는 공식 요금 근거와 표·도구·FAQ 구조를 확보해 `BRIEF_READY`로 승격했으나 시설별 예외와 내부링크 계획이 남아 발행 차단
- 누적 상태: `RESEARCHING 136`, `BRIEF_READY 21`, `READY_TO_LAUNCH 0`, 전체 `SAME_INTENT 2`
- 오늘 발행: `0 / 3`; launch manifest는 `NO_PUBLICATION`
- 다음 행동: 환불 계산기와 추가요금 계산기의 날짜·요금 경계 테스트 및 내부링크 계획을 비교해 더 완결성 높은 한 후보만 READY 승격 검토
- 보호: 기존 WINNER 및 논산·철원·울진 COOLDOWN 수정 없음
## 2026-09-08 01:28 KST 외부 탐색 자동 실행

- Discovery origin: `EXTERNAL_WEB`
- 신규 발견 후보: 10개 (`Google 5`, `Naver 2`, `Other websites 3`)
- 신규 후보군: 여행자 휴대품 예상세액 입력, 면세범위 초과, 술·담배·향수 별도 한도, 자진신고 감면, 미신고 가산세, 외화 신고, 농축수산물, 의약품·건강기능식품, CITES 기념품, 국내 면세점 구매품 재반입
- 정확한 검색량은 생성하지 않고 모두 `OBSERVED_SEARCH_SIGNAL`로 기록했으며 관세청 공식 자료에 reviewed date를 저장
- 기존 19,066페이지 제목·본문 검색과 후보 DB에서 동일 intent를 발견하지 못해 `NO_OVERLAP`으로 두되, 모두 YMYL 후보로 limitations와 disclaimer를 필수 기록
- 추가 공식기관 교차검증과 완성 Content Brief가 없으므로 전부 `RESEARCHING`; 자동 발행하지 않음
- 누적 상태: `RESEARCHING 146`, `BRIEF_READY 21`, `READY_TO_LAUNCH 0`, 전체 `SAME_INTENT 2`
- 오늘 발행: `0 / 3`; launch manifest는 `NO_PUBLICATION`
- TOP 신규 후보: 여행자 휴대품 자진신고 감면 예상액 계산기; 다음 행동은 최신 고시·감면한도·공식 계산기 결과를 날짜 경계 사례로 검증
- 보호: 기존 WINNER, 논산·철원·울진 COOLDOWN 및 기존 도로여행 계산기 실험 수정 없음
## 2026-09-08 03:28 KST 외부 탐색 자동 실행

- Discovery origin: `EXTERNAL_WEB`
- 신규 발견 후보: 10개 (`Google 5`, `Naver 2`, `Other websites 3`)
- 신규 후보군: 기내 액체류 포장, 보조배터리 Wh, 면세 액체 환승, 유아 이유식 보안검색, 교통약자 우대출구, 셀프백드롭, 수유실, 샤워실, 교통약자 수하물 배송, 어린이 놀이시설
- 인천국제공항 공식 보안검색·맞춤형 서비스·시설 정보를 근거로 사용하고 검색량은 `OBSERVED_SEARCH_SIGNAL`로만 기록
- 기존 19,066페이지와 후보 DB에서 직접 동일 intent는 없었으며 광범위 여행 콘텐츠와 가까운 후보는 추가 의미 중복 검증 전 발행하지 않음
- 누적 상태: `RESEARCHING 156`, `BRIEF_READY 21`, `READY_TO_LAUNCH 0`, 전체 `SAME_INTENT 2`
- 오늘 발행: `0 / 3`; launch manifest는 `NO_PUBLICATION`
- TOP 신규 후보: 보조배터리 Wh 변환·기내반입 확인기; 다음 행동은 항공사별 최신 승인·개수·포장 규정을 교차검증하고 계산 테스트 벡터 작성
- 보호: 기존 WINNER, 논산·철원·울진 COOLDOWN 및 기존 발행 실험 수정 없음
## 2026-09-08 07:29 KST 외부 후보 정밀 조사

- Discovery origin: `EXTERNAL_WEB`
- 신규 후보 적재: 0개; 직전 회차 최우선 후보에 대한 공식 근거 10건을 검토
- `EXT-20260908-172` 보조배터리 Wh 변환·기내반입 확인기를 인천공항·대한항공·아시아나항공·제주항공 공식 규정으로 교차검증
- Wh 계산식, 100Wh·160Wh 구간, 승인 필요 여부, 위탁 금지, 단락방지 및 기내 보관 조건을 Brief에 기록
- 항공사별 허용 수량 표현과 해외 출발지 예외가 달라 단일 확정 판정을 금지하고 각 항공사 공식 확인을 필수로 설계
- 내부링크 계획과 UI 입력 오류 테스트가 남아 `BRIEF_READY`까지만 승격하고 `READY_TO_LAUNCH`·발행은 차단
- 누적 상태: `RESEARCHING 155`, `BRIEF_READY 22`, `READY_TO_LAUNCH 0`, 전체 `SAME_INTENT 2`
- 오늘 발행: `0 / 3`
- 다음 행동: 전압 미표기, 0·음수·소수 입력, 정확히 100Wh·160Wh 경계 테스트와 내부링크 계획 완성
- 보호: 기존 WINNER, 논산·철원·울진 COOLDOWN 및 기존 발행 실험 수정 없음
## 2026-09-08 11:30 KST 대기 콘텐츠 자동 발행

- 발행: `1 / 3` — `/kor/util/power-bank-wh-calculator/`
- Candidate: `EXT-20260908-172`; Experiment: `EXP-CONTENT-20260908-01`
- 선택 이유: Opportunity `87.3`, Quality `79.7`, `NO_OVERLAP`, 공식 출처 3개, 입력형 계산 차별성
- 구현: mAh·전압을 Wh로 변환하고 100Wh 이하·100~160Wh·160Wh 초과 구간을 구분
- 안전 설계: 결과를 운송 허가로 단정하지 않고 항공사별 수량·승인·해외 출발지 규정을 공식 링크에서 재확인하도록 안내
- QA: 정확히 100Wh·160Wh, 99.9Wh·159.1Wh·185Wh, 누락·0·음수·문자 입력 테스트
- 내부링크: 유틸리티 허브에서 신규 도구 연결, 도구에서 여행 허브·준비물·도로여행 계산기로 연결
- sitemap 및 index request candidate 갱신
- Baseline: 실제 검색·GA4·AdSense URL 데이터가 아직 없어 모두 `NOT_AVAILABLE` 또는 `NOT_CONNECTED`; 숫자를 생성하지 않음
- 관찰 종료 및 COOLDOWN: `2026-10-06`; 그 전에는 기술·정책 오류 외 재수정 금지
- 보류: 캠핑 차량·전기 추가요금 및 야영장 환불 계산기는 시설별 예외·책임 규정 검증이 남아 미발행
## 2026-09-08 11:30 KST 대기 콘텐츠 자동 발행

- 발행: `1 / 3` — `/kor/util/power-bank-wh-calculator/`
- 후보: `EXT-20260908-172`, Opportunity `87.3`, Quality `79.7`, overlap `NO_OVERLAP`
- 실험: `EXP-CONTENT-20260908-01`, 관찰 종료 및 COOLDOWN `2026-10-06`
- 구현 가치: mAh·전압을 Wh로 변환하고 100Wh·160Wh 구간, 단락방지와 공식 항공사 확인 경로를 함께 제공
- 공식 출처: 인천국제공항·대한항공·제주항공, reviewed `2026-09-08`
- 테스트 범위: 정확히 100Wh·160Wh, 100Wh 미만·초과, 160Wh 초과, 누락·0·음수·비숫자 입력
- 연결: `/kor/util/` 허브, `kor/sitemap.xml`, Google index request candidate 갱신
- 기준 데이터가 없는 발행 전 검색·GA4·AdSense 수치는 `NOT_AVAILABLE` 또는 `NOT_CONNECTED`로 보존하고 생성하지 않음
- 보류: 국립공원 차량·전기 추가요금 및 취소 환불 계산기는 시설별 예외 검증이 부족해 미발행
- 보호: 기존 WINNER와 논산·철원·울진 COOLDOWN 변경 없음

## 2026-09-08 GitHub Actions 발행 검증 오류 수정

- 실패 실행: SEO QA `34190831690`; 오류 코드 `MANIFEST_DIFF_MISMATCH`
- 원인: 외부 콘텐츠 자동 발행기는 manifest 상태를 `PUBLISHED`로 기록하지만, 일일 성장 분석기는 `LAUNCHED`만 당일 완료 상태로 보존해 CI 검증 직전에 발행 manifest를 덮어씀
- 수정: 당일 실험 기록과 candidate ID가 일치하면 `LAUNCHED`와 `PUBLISHED` 상태를 모두 보존
- 후속 커밋 보호: 이전 발행 manifest가 남아 있어도 현재 diff에 신규 HTML이나 manifest 변경이 없으면 과거 발행 파일을 다시 요구하지 않음; WINNER·COOLDOWN·삭제·분석/광고 코드 보호 검사는 계속 수행
- 회귀 테스트: `PUBLISHED` manifest가 CI의 일일 분석 단계에서 덮어쓰이지 않는 시나리오 추가
- 영향 범위: 발행 파일·URL·canonical·광고·분석 코드에는 변경 없음

## 2026-09-08 15:13 KST 팰월드 신규 공략 발행

- 외부 탐색에서 팰월드 1.0 초보·초반 공략이 Google·네이버 검색 결과에 반복 노출되는 수요 신호를 확인
- 정확한 검색량은 알 수 없어 `OBSERVED_SEARCH_SIGNAL`로 기록하고 수치를 생성하지 않음
- 기존 19,000여 페이지와 동일 intent 없음: `NO_OVERLAP`
- Opportunity `78.6`, Quality `80.0`; 공식 1.0 변경 기록과 Steam 제품 설명으로 핵심 시스템 검증
- 차별점: 팁 나열이 아니라 첫날 행동 순서, 거점 작업 적성 진단표, 막혔을 때 다음 행동을 한 화면에 제공
- 실험: `EXP-CONTENT-20260908-02`; 관찰 종료 및 COOLDOWN `2026-10-06`
- 발행 전 Google·네이버·GA4·AdSense URL 지표는 `NOT_AVAILABLE` 또는 `NOT_CONNECTED`
- 기존 WINNER와 논산·철원·울진 CTR 실험은 수정하지 않음
