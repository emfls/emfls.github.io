# 기존 일본 eSIM 계산기 — 정확 승인

2026-11-08 사용자의 상위노출·기능 복구 비상주 위임을 적용한다. 기존 메인사이트 한 도구만 대상으로 하며 중단한 CSV/Excel/서브도메인 사업과 관계없다.

## 근거와 범위

GSC 완료 10/9~11/5(America/Los_Angeles) page 3click/136impression/평균7.24. 같은 URL 필터 query 원문에서 '일본여행 데이터 사용량'18노출·'일본 여행 데이터 사용량'13노출·'일본 데이터 사용량'8노출과 하루 사용량 변형이 확인됐다. 이 쿼리들은0클릭이며 비반환·익명쿼리는0이 아니다. 독립 GA4 10/11~11/7(Asia/Seoul)은6조회·6사용자·기록광고수익0.015785로 소표본이다. 기간/시간대를 합산하지 않으며 클릭 감소·예상 수익을 만들지 않는다.

기존 화면은 전체 GB만 보여준다. 실제 public390px에서30일/영상600분은80GB base/96GB buffer로 잘렸으며20~60일도 동일 ceiling이다. 출력 상한과 합산 전 반올림을 제거해 기존 일일 계수대로 일일×여행일수를 계산하고 최종20%여유만0.1GB단위 올림한다. 적은 양이0으로 사라지는 문제도 동일 계산 경로에서 복구한다. 입력범위/추천구간/고정 계수는 그대로다. 하루 MB·GB와 전체 예상·여유포함 용량을 구분하고 입력 전 간단한 하루 답변을 제공한다. 새 HTML/구 JS 캐시 혼합 방지용 asset hash만 추가한다. 제목/meta/canonical/GA4/광고/기존링크/발행은 보존한다.

## 보호와 정확 버전

실제 OPS `/Users/whitesmile/Developer/emfls-ops`, pin `9a5ef58d459697642f36d2f494be6c48387ac9b3`. route/current·pin WINNER/PROTECT,cooldownfalse. 직접 관측 실험 매치0이나 전체 원장 완전성UNKNOWN, pin일부자료NOT_AVAILABLE을 유지한다. 원장·pin·관측상태를 바꾸지 않는다.

| 파일 | before blob | after blob |
|---|---|---|
| kor/util/japan-esim-data-calculator/index.html | 993c7610169b2d10c4f111929d2fa330d901d040 | 010557d00c6d82db4c5477e39e4a7f0624e73265 |
| kor/util/japan-esim-data-calculator/app.js | 562d0d3ba429e1df9258ff7e379496ff84e28aa8 | 57a746dc2cd6b8a2059f3a017a8a865d6999818a |

정확승인PR을 먼저 병합한 뒤 별도 콘텐츠PR로 배포한다. Guard는 현재 WINNER route를index.html로 매핑해 HTML 전이를 검사하며 app.js 의존성까지 자동 보호하지 않는다. JS도 위 정확 버전으로 동결해 수치·화면 회귀와 별도 검토를 한다. 다른 blob/역방향/다른 WINNER/OBSERVING 차단을 회귀검증한다. 이것은 보호해제·포괄승인이 아니다.

## 검증·관측·복구

Node 일일/장기/소량/테더링/입력경계와 기존 계산기 회귀, 관련Python계약, 실제OPS Guard, 동일main SEO무회귀, 모바일320/390/430과 공개 exact HTML/JS·실제 계산을 확인한다. 반복QA의 광고/GA는 차단하며 실제 휴대폰·통신사사용량·유입/수익효과는 미검증이다. 정해진 계수는 모델 가정이지 실측/통신사 보증이 아니다.

배포혼합11/8을 제외해 전11/1~7·후11/9~15,11/16이후 원천완료시 기존09/18점검에서 URL별GSC/GA4를 별도 비교한다. 기존14URL·사이트전체광고 개입 유지, 중복예약없음. 순위/클릭/수익효과UNMEASURED. 원상복구도 정확역방향승인·QA가 필요하다. 최소 원문/동결/재현/공개근거는 로컬 `reports/emfls-esim-search-2026-11-08/`에 보존한다.
