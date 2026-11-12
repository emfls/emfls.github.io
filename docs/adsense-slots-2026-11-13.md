# AdSense 슬롯 로컬 변경 — 2026-11-13

## 최신 상태 — 추가 앵커 검수 완료

최종 칼럼은 373개 중 **232개 적용·130개 보호·11개 앵커 HOLD**다. 아래 159개는 1차 커밋의 보존 이력이다. 84개 보류 중 73개는 컨테이너 밖의 orphan closing tag로 확인했다. 브라우저가 무시하는 빈 stack의 닫는 태그만 무시하며 실제 중첩 불일치는 계속 HOLD한다. 원문을 수정/정규화하지 않고 삽입만 했다.

수정 전 실패 → 수정 후 통과 회귀와 독립 검수를 완료했다. 최종 관련 회귀 **97 PASS**(patcher/광고 안전/자동화 안전/생성기 domain/기존 Launch Guard). 전체 pytest의 위 기존 40 FAIL은 그대로 남으며, 이 최종 좁은 파서/marker 변경 뒤 전체를 또 반복하거나 exact-head CI PASS라고 주장하지 않는다. 칼럼 232개 모두 삽입 제거 시 최초 main과 바이트 동일하고, 보류 141개 원문도 동일하다.

앵커 HOLD 11개는 카드 2개뿐인 7개, 목록 index 1개, 닫히지 않은 컨테이너 3개다. 세 번째 카드가 없는데 임의 위치에 넣거나 내용을 덧붙이지 않았다. 준비물/캠핑/게임의 보호·중단 조건도 유지한다. 320/390px 대표 검수는 최종에도 그대로 남는 칼럼·계산기와 광고 없는 게임 기준선이다. 캠핑 캡처는 미적용안이다.

1차 커밋 Guard는 MONETIZATION_OR_ANALYTICS_CHANGED로 FAIL했다. 광고 관련 문서 경로도 검사 대상이며 이름을 바꾸어 우회하지 않았다. 최종 커밋의 실제 검사 결과는 Vault 실행 보고서에 남긴다. 이 기능 브랜치의 로컬 커밋은 운영 출고 승인이 아니다.

이 브랜치는 배포하지 않은 로컬 검토 후보다. Active View 59.4%·RPM $2.57의 보고 기간/페이지별 귀속과 원인은 이번에 재측정하지 않았다. 광고 위치 변경이 가시성·수익 상승을 보장하지 않는다.

## 구현 범위

- 기준 main: e61550880a45f4f6f570631ad69e8fb670c4d329.
- 브랜치: feature/adsense-rpm-slots-optimization. 기존 사용자 checkout과 main은 수정하지 않았다.
- build_column_page.py: hero 뒤 min-height 280px, 3번째 비어 있지 않은 section 뒤 min-height 250px. 기존 loader/GA는 보존한다.
- scripts/patch_adsense_slots.py: 표준 HTMLParser로 중첩 div를 구분하고 두 앵커가 모두 정확할 때만 삽입한다. 기본 dry-run, 지정 feature branch와 VERIFIED 보호 입력에서 apply한다. symlink·보호·알 수 없는 앵커·부분 marker는 HOLD다. 파일별 임시 파일/atomic replace를 사용한다.
- 현재 칼럼은 373개다. 159개 로컬 변경, 보호 130개·앵커 불명 84개 보존. 재실행 변경 0. 381개 완료라고 보고하지 않는다.
- 복리/BMI: result DOM 바로 뒤 독립 슬롯. 결과 innerHTML 갱신에 광고가 제거되거나 재요청되지 않는다. 250px 최소 예약 공간, 좁은 화면에서 반응형 폭.
- autocamping-best.html: 실제 기존 10개 카드의 3·7번째 뒤 native In-feed의 정확 diff와 320/390px 미리보기를 준비했으나 고정 pin의 WINNER임을 확인하여 적용은 제거했다. 파일은 main과 동일하다. 다른 캠핑 기사는 변경하지 않는다.

## 실제 계정 코드 및 정책

2026-11-13 기존 정상 로그인 AdSense 광고 단위 UI를 읽었다. 설정 생성/수정/저장은 0이다.

- display 6016035748: data-ad-format auto/full-width-responsive true.
- camp-in-article 3423411629: data-ad-layout in-article/data-ad-format fluid.
- In-feed 5441320677: data-ad-format fluid/layout-key -6u+cw+56-h-7x.
- 설계서의 display ID 5182890312를 native 형식으로 재포장하지 않았다. 기존 HTML에 있던 해당 단위는 건드리지 않았다.

[In-article 공식 배치](https://support.google.com/adsense/answer/9274522)는 실제 해당 형식의 단위를 생성한 코드를 쓰고 광고 사이에 충분한 본문을 두도록 안내한다. [In-feed 공식 배치](https://support.google.com/adsense/answer/9189560?hl=en)는 실제 피드 내부에 계정 코드를 사용하도록 안내한다. 새 단위 생성이나 광고 계정 설정 변경은 하지 않았다.

[공식 광고 배치 정책](https://support.google.com/adsense/answer/1346295?hl=en)과 [배치 권장사항](https://support.google.com/adsense/answer/1282097?hl=en)에 따라 광고를 Advertisement로 명확히 표시하고 콘텐츠/버튼처럼 위장하지 않는다. 기존 코드의 클리핑/GA/광고 로직을 새로 완화하지 않았다.

## 의도적으로 적용하지 않은 범위

- 준비물 도구는 현행 WINNER다. 파일은 그대로 두고 정확 별도 diff만 Vault에 준비했다.
- 최초 현행 원장 보호 121개 중 103개는 적용 가능한 정확 blob/diff 제안을 별도로 만들었으나 파일은 변경하지 않았다. 나머지는 앵커도 불명확하다. 보호 코드/원장/pin은 수정하지 않았다.
- FlappyDot는 607c05c125dbfaa0bf681c4e329dce5205edc21a(2026-08-12)의 interactive-page 정책과 scripts/remove_sensitive_page_ads.py가 의도적으로 광고를 제거한 대상이다. 단순 누락 복구로 분류하지 않았다. [게임 광고 공식 지침](https://support.google.com/adsense/answer/2768340?hl=en)은 게임/컨트롤과 최소 150px 간격을 강하게 권장한다. 재시작 시 광고 refresh는 구현하지 않는다. 게임 화면은 광고 없는 기준선으로만 검수했다.

## 검증 및 해석

새 패치/원자적 실패/멱등/보호/중첩 앵커/템플릿/native 피드 테스트와 기존 광고 안전 회귀를 실행했다. 계산기 실제 입력: 원금 1000·월입금 0·10%·1년·연복리 → 1100, BMI 170cm/60kg → 20.8 Normal. 복리 반복 계산 후 광고 queue 1개 유지, 슬롯 원문 동일.

실제 ego(lite) 로컬 렌더에서 칼럼·복리·BMI·캠핑·게임 320/390px 모두 document width가 viewport와 같았다. 새 템플릿도 두 폭에서 넘침 0이다. CSP가 외부 광고·GA·프레임을 차단했으므로 실광고 fill/Active View/field CLS는 미검증이다. min-height는 예약 공간이며 반응형 광고가 더 커지면 추가 이동 가능성이 있다. 빈 광고 예약 공간이 독자의 첫 본문을 늦출 수 있어 실제 출고 전 재검토해야 한다.

전체 회귀와 baseline 대조의 최종 수치 및 Guard 결과는 아래 최종절에 기록한다. 실패한 회귀/Guard를 성공으로 보고하거나 테스트 기준을 완화하지 않는다.

## 복구

운영 반영은 0이다. 로컬 검토 commit을 제외하면 원본 사용자 작업은 그대로다. 향후 정상 출고를 승인받더라도 실제 source drift·보호·CI를 다시 대조한다. 복구는 해당 작업의 정확 commit만 정상 revert하고, 원본 전체 덮어쓰기나 force push를 하지 않는다. 광고 설정·예약·원고 원장은 별도 변경하지 않는다.

고정 pin 추가 대조: 현재 원장에 없는 과거 WINNER 8개 칼럼과 autocamping-best가 변경 후보에 포함돼 있었다. 자신의 삽입분만 정확 제거했고, source/pin/승인 목록은 변경하지 않았다. 최종 칼럼 분류는 159개 적용·130개 보호·84개 앵커 HOLD다. CLI는 같은 고정 pin snapshot을 읽어 현재 보호와 합집합으로 제외하며 pin 읽기·조상 검증 실패도 UNKNOWN으로 처리한다.


## 측정 기준과 한계

[Google Active View 정의](https://support.google.com/adsense/answer/4510652?hl=en-GB)는 측정 가능한 노출 중 보이는 노출의 비율이며, 일반 display에서는 광고 픽셀 50% 이상이 연속 1초 보이는 조건이다. [Google 가시성 권장사항](https://support.google.com/adsense/answer/6219980?hl=en)은 실제 화면 크기/페이지 접힘 위치를 먼저 확인하도록 안내한다. 빈 슬롯을 로컬에서 보았다는 사실은 Active View 측정이 아니다.

[web.dev CLS 안내](https://web.dev/articles/optimize-cls/)의 공간 예약 원칙을 적용했다. min-height는 CLS 위험을 줄이는 준비이며 실제 creative의 크기/추가 확장을 검증하지 않은 CLS 0 보장이 아니다. 향후 정상 출고가 완료됐을 때만 같은 사이트·단위·기기·완료 기간의 PV/요청/노출/Active View/RPM을 비교한다. 관측 예약은 새로 만들지 않는다.


## 최종 검증 결과

- 새로운 로직과 기존 광고 안전 회귀: 20 PASS. 독립 검수의 단일/중복 marker 오판 1건은 수정 전 재현 후 해결했고 검수자의 재확인 1 PASS를 받았다.
- 중간 전체 unittest: 984 실행, 실패 18·오류 1·skip 3. 같은 main의 선택 16메서드(실패 18·오류 1)에서 재현됐다. 오류는 격리 OPS의 승인 JSON 결측이었고 기존 JSON을 준비한 뒤 해당 검사는 PASS했다.
- 고정 pin 보호 복원 후 전체 pytest: 1,666 PASS·40 FAIL·3 skip, exit 1. 실패 40개 모두 동일 main에서 실제 재현한 기존 실패 node 목록에 포함된다. 기준본 전체를 반복한 것은 아니다.
- 초기 임시 template HTML이 canonical 검사에 추가 오류를 만들었다. 자신의 fixture를 사이트 트리 밖으로 옮긴 후 좁은 재검사에서 양쪽 모두 기존 raw-template canonical 오류만 남았으며 최종 전체에는 fixture가 없었다.
- 마지막 전체 검사 후 수정한 것은 marker 완료/부분 판정뿐이다. 그 최종 코드에 위 20개 집중 회귀와 멱등 apply 검사를 다시 실행했다. 마지막 전체를 최종 커밋의 exact-head CI 성공으로 부르지 않는다.
- 최종 두 번째 apply: 159 ALREADY_PATCHED·130 PROTECTED_HOLD·84 ANCHOR_HOLD, 수정 0. 변경 대상에 현재/고정 pin 보호 경로 겹침 0. 모든 새 삽입을 제거하면 원래 HTML 바이트와 같고 meta/canonical/GA/기존 scripts를 보존한다.
- 전체 회귀가 FAIL이므로 출고 HOLD. 관련 기대값·검사 기준·승인 목록·원장·자동 발행/계정 설정은 변경하지 않았다.
