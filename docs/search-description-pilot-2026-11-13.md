# Existing search-description pilot — 2026-11-13

Three already-published car guides had descriptions copied from introductions and cut off mid-sentence. Replace only the search description, Open Graph description, Twitter description and JSON-LD description with complete summaries matching each existing article. Titles, H1, body, canonical, dates, links, ads, GA4 and publisher behavior are unchanged.

## Scope and baseline

Base: `9f10378f21773984a05bc3203d1df3a026f02deb`. All three paths are outside both the immutable pinned protection snapshot and the currently available local OPS protection/OBSERVING/COOLDOWN lists. This check is not a claim about a complete live account experiment inventory. No protection entries or assertions were changed.

Naver Search Advisor recent-7-day page table, last updated 2026-11-12, showed double parking 50 clicks/1,153 impressions, charging limit 31/626, and navigation reset 28/860. This is a relative UI reporting window, not an invented exact-date range. The query table has no direct page join key; no URL-level revenue or ranking gain is inferred.

## Descriptions

### `kor/report/car/2026-ioniq5-ev6-charging-limit-80-90-100-ac-dc-target-setting.html`

Before: 전기차가 충전 중 80%에서 멈추거나 현재 잔량이 85%인데 충전이 시작되지 않는다면, 충전기 고장보다 먼저 차량의 충전 목표 배터리량을 확인해 보세요. 현대자동차의 2025년형 아이오닉 5 설명서는 급속·완속 목표량을 따로 저장하며 50~100% 사이에서 10% 단위

After: 아이오닉 5·EV6의 완속·급속 충전 상한을 80%·90%·100%로 설정하는 방법을 정리했습니다. 목표 배터리량과 현재 잔량, 예약충전·충전기 제한의 차이를 차종·연식별 설명서와 함께 확인하세요.

### `kor/report/car/ev-double-parking-neutral-n-mode-ioniq5-ev6-2026.html`

Before: 아파트 주차장에서 이중주차를 하려고 전기차의 변속 다이얼을 N(중립)에 놓았는데, 전원을 끄자 다시 P(주차)로 돌아가는 상황을 경험할 수 있습니다. 오토홀드(AUTO HOLD)나 전자식 파킹 브레이크(EPB)가 켜져 있으면 N단을 선택해도 차가 움직이지 않을 수 있습

After: 아이오닉 5·EV6 이중주차에서 N단이 P단으로 바뀌는 이유와 오토홀드·EPB 확인 항목을 정리했습니다. 차종·연식별 중립주차와 자동세차용 N단 유지 모드의 차이, 안전 확인사항을 살펴보세요.

### `kor/report/car/ev-navigation-screen-frozen-reset-2026.html`

Before: 아이오닉 5나 EV6를 타다가 내비게이션 화면이 멈추거나 아무것도 표시되지 않으면 당황하기 쉽습니다. 테슬라 Model 3처럼 중앙 터치스크린으로 차량 상태를 확인하는 차종이라면 더 그렇습니다. 인터넷에는 &#x27;버튼 두 개를 동시에 누르라&#x27;, &#x27;

After: 아이오닉 5·EV6 내비게이션 화면 먹통 증상과 차종별 리셋 확인사항을 정리했습니다. 인포테인먼트와 계기판, 재시작과 설정 초기화의 차이 및 계속 문제가 생길 때의 점검 항목을 확인하세요.

## Validation and observation

- Focused content metadata, Launch Guard and Notion discovery tests: 82 passed. Independent review found no material defect; byte comparison allows exactly the twelve description fields, with all other HTML bytes unchanged. The existing visible `.deck` truncation is outside this metadata-only change.
- Full current-tree SEO audit compared against exact-base blobs: 19,500 pages, no parser errors, no new criticals/warnings; existing criticals 646 and warnings 420 remain. The source OPS baseline was not edited.
- Committed Launch Guard, normal PR merge, Pages and exact public HTTP verification are recorded separately after release. This document does not claim those future results.
- Search snippets can use page text instead of the description, and recrawl/reprocessing takes time. [Google snippet guidance](https://developers.google.com/search/docs/appearance/snippet) and [title-link guidance](https://developers.google.com/search/docs/appearance/title-link) do not promise immediate CTR or revenue gains.
- For follow-up use complete, comparable source periods after deployment: 7 days for an initial reading, 14–28 days for stronger evidence. Exclude the mixed deployment day; preserve concurrent ad/site changes as confounders. No new monitoring job was created.

## Scope limits and rollback

These are editorial summaries for three existing documents, not a shared-generator repair. A future source re-export could replace them, so compare these descriptions before republishing the same articles. The shared generator accepts the upstream description and is unchanged. Revert the content commit through the normal PR process if the summaries prove inaccurate. No URL changes or new content are needed.
