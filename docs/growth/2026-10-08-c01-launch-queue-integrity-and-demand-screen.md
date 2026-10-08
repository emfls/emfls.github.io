# C01 Launch Queue Integrity and Fresh Demand Screen — 2026-10-08

## Scope and decision

- Repository base: `267b73fa46854e6d319149df789f2b7708a1c6a4`.
- Phase A reproduced a fail-open path for an editorial HOLD that was not mirrored into the repository, a `NO_NEW_PAGE` decision discarded by the loader/queue, and two labor/leave keywords that the YMYL text rules did not recognize.
- The final content launch guard did not consult editorial decisions or require YMYL approval. The runbook grants downstream publication authority to items that pass the launch gates as `READY_TO_LAUNCH`, so an item could proceed without a new page-by-page approval.
- The repaired queue and final guard block those cases. Candidate identifiers and a readable, valid decision file are required at the final guard.
- Phase B screened 30 distinct tasks. Four exact rows in the reviewed pool have valid `HIGH` Naver Search Ads observations. None has both a demonstrated unmet SERP task and acceptable maintenance/overlap evidence. No TOP 1 or content brief is approved.
- No HTML, sitemap, publication manifest, launch counter, or CODEX 2 measurement file was changed.

## Phase A — end-to-end trace

| Candidate | Initial queue | Editorial decision before repair | Initial YMYL result | Initial final guard | Publication path before repair | Repaired result |
|---|---|---|---|---|---|---|
| `연차개수계산기` | `READY_TO_LAUNCH` / `PAGE_REVIEW_READY` | No exact repository decision; Control Tower review was required | Missed because `연차개수` was not a signal | Did not enforce YMYL review | Could pass the generic launch gates under the existing pre-authorization | Excluded as YMYL; final guard requires explicit `APPROVE` |
| `인건비계산기` | `READY_TO_LAUNCH` / `PAGE_REVIEW_READY` | Control Tower `HOLD` was not mirrored in the launch decision file | Missed because `인건비` was not a signal | Did not enforce editorial decisions | Could pass the generic launch gates without the HOLD being seen | Mirrored `HOLD`, excluded from queue, final guard blocks |
| `엔카중고차구매` | `READY_TO_LAUNCH` / `PAGE_REVIEW_READY` | Control Tower `NO_NEW_PAGE` | Not YMYL by this classifier | Did not enforce editorial decisions | Loader discarded `NO_NEW_PAGE`; candidate could pass generic launch gates | Mirrored `NO_NEW_PAGE`, excluded from queue, final guard blocks |
| `글자수계산기` (safe control) | Eligible | No blocking decision | Not YMYL | Passes when content, manifest, sitemap, and hub checks pass | Remains eligible | Still eligible; YMYL approval is not imposed on safe candidates |

The Keyword Hunter workflow writes the supervised queue; it does not write content HTML. The actual fail-open was the path from that queue through the pre-authorized launch gates and the final PR guard. Before this change, the final guard did not stop any of the three candidates on their editorial/YMYL status.

The final guard now rejects added HTML when candidate IDs are absent, duplicated, or not in the `keyword:` namespace; when the editorial decision store is missing/invalid; when a candidate is on `HOLD`, `NO_NEW_PAGE`, or `UPDATE_EXISTING`; or when a YMYL candidate lacks explicit `APPROVE`.

## Phase B — 30-task initial screen

Demand labels: `H:n/mo` means a score-valid `HIGH` exact-keyword Naver Search Ads observation with the stated monthly estimate. Its check date is shown in the source column. `L:n/mo` is a numeric estimate with `LOW` confidence and an invalid composite score; it is not verified demand. `U` means no valid exact-keyword observation was available. A checked month estimate is not a revenue forecast.

`NOT_SAMPLED` means no live SERP assessment was made for that initial-screen row. The five shortlisted rows below were searched live. Exact-title/index checks are an overlap screen, not proof that no semantic overlap exists.

| # | Keyword / distinct user task | Demand / source / check date | SERP competition | Existing-site overlap / prior review | YMYL / upkeep | Distinct task / recommendation |
|---:|---|---|---|---|---|---|
| 1 | `인천공항교통약자우대출구` — eligibility, proof, and terminal exit | H:300/mo; Naver Search Ads; 2026-10-08 | Official airport result directly answers the query | No exact page; no prior content review found. Local C01 HOLD recorded after SERP review. | Low / low-medium | Distinct task, but no demonstrated gap; HOLD |
| 2 | `애견동반캠핑장` — find a campsite and verify pet rules | L:12,780/mo; Naver Search Ads; 2026-10-07; invalid score | High: tourism directory, pet-specific listings, and booking pages | Broad camp inventory; no pet filter/page found by exact-title screen; no prior exact review found | Low-medium / high | Distinct task; volume is not verified; do not launch |
| 3 | `겨울글램핑장추천` — compare winter heating before booking | U for exact query; adjacent `겨울글램핑` L:590/mo, invalid; Naver Search Ads; 2026-10-07 | High: recent checklist/listicles plus property booking pages | Two existing national glamping guides; no prior exact decision found | Low-medium / high | Similar task already covered; reject new page |
| 4 | `Steam Cloud 충돌에서 저장 파일을 고르기 전 백업` | U; no valid exact observation | High: official Steam support and specialist guides | No exact save-conflict page; no prior exact review found | Low, data-loss risk / medium | Distinct task, but volume unverified and official guidance is strong; monitor only |
| 5 | `갤럭시 USB 파일 전송` — phone folder missing on PC | U; no valid exact observation | High: Samsung support and device-maker support pages | One USB-install guide, different task; no exact phone-transfer page; no prior exact review found | Low / medium | Distinct task, but official FAQ answers it; no page |
| 6 | `패키지여행비교사이트` — compare package-tour sites | H:300/mo; Naver Search Ads; 2026-10-03 | NOT_SAMPLED | Broad travel inventory; no exact comparison page found; no prior exact content review found | Low / high | Distinct task possible; prices and inclusions change; defer until SERP gap is shown |
| 7 | `신혼여행비용` — estimate honeymoon trip budgets | H:500/mo; Naver Search Ads; 2026-10-07 | NOT_SAMPLED | Destination pages exist; no exact honeymoon-budget page found; no prior exact review found | Low-medium / high | Distinct task possible; volatile prices; defer pending SERP and update-cost review |
| 8 | `해외구매대행쇼핑몰` — choose a purchasing-agency shopping site | H:270/mo; Naver Search Ads; 2026-10-07 | NOT_SAMPLED | Existing `/kor/column/1688gumaedaehaeng/` covers the adjacent task; Keyword Hunter top row 2026-09-23, but no prior editorial review found | Medium / high | Intent boundary uncertain and existing guide is close; no new page |
| 9 | `캠핑장 야간 체크인` — arrive after staffed check-in closes | U; no valid exact observation | NOT_SAMPLED | Broad campsite pages; no exact check-in procedure page found | Low / high | Distinct operational task; venue rules change; demand first |
| 10 | `캠핑장 전기 용량` — check site outlet and breaker limits | U; no valid exact observation | NOT_SAMPLED | Camp gear and power-bank content may overlap; no exact site-capacity guide found | Medium / high | Distinct task; property-specific and safety-sensitive; demand first |
| 11 | `텐트 결로 줄이는 방법` — reduce condensation during a night | U; no valid exact observation | NOT_SAMPLED | Broad camp/gear inventory; no exact condensation guide found | Low-medium / medium | Distinct practical task; demand and source gap unverified |
| 12 | `비 맞은 텐트 말리는 방법` — dry and store a wet tent | U; no valid exact observation | NOT_SAMPLED | Broad camp/gear inventory; no exact drying guide found | Low / low-medium | Separate post-trip task; demand unverified |
| 13 | `Steam Workshop 다운로드 멈춤` — resume a stuck mod download | U; no valid exact observation | NOT_SAMPLED | No exact Steam Workshop page found; no prior exact review found | Low / medium | Distinct task; demand unverified |
| 14 | `Steam 가족 공유 게임 이용 불가` — understand library access denial | U; no valid exact observation | NOT_SAMPLED | No exact page found; no prior exact review found | Low / medium-high | Distinct task; feature rules can change; demand unverified |
| 15 | `Steam 오버레이 단축키 작동 안 함` — open in-game overlay | U; no valid exact observation | NOT_SAMPLED | No exact page found; no prior exact review found | Low / medium | Distinct task; demand unverified |
| 16 | `Discord 게임 음성 채팅 마이크 미검출` — restore game voice input | U; no valid exact observation | NOT_SAMPLED | No exact page found; adjacent general PC/game setup content needs review | Low / medium | Distinct app-level task; demand unverified |
| 17 | `Minecraft 친구 월드 참가 실패` — join a friend's world | U; no valid exact observation | NOT_SAMPLED | No exact page found; no prior exact review found | Low / medium | Distinct connectivity task; demand unverified |
| 18 | `Minecraft 리소스팩 적용 안 됨` — make an installed pack take effect | U; no valid exact observation | NOT_SAMPLED | No exact page found; no prior exact review found | Low / medium | Separate configuration task; demand unverified |
| 19 | `Steam Input 컨트롤러 인식 안 됨` — make a controller appear in Steam | U; no valid exact observation | NOT_SAMPLED | No exact page found; no prior exact review found | Low / medium | Distinct input setup task; demand unverified |
| 20 | `PC 게임 다른 모니터에서 실행` — choose the display for a game window | U; no valid exact observation | NOT_SAMPLED | General Windows display guidance may overlap; no exact game-display page found | Low / medium | Distinct task; demand unverified |
| 21 | `Windows USB-C 모니터 화면 안 나옴` — check video capability and display settings | U; no valid exact observation | NOT_SAMPLED | USB installation guide is a different task; no exact monitor page found | Low / medium-high | Distinct compatibility task; hardware-specific; demand unverified |
| 22 | `Windows 블루투스 헤드셋 마이크 선택` — use the headset mic as input | U; no valid exact observation | NOT_SAMPLED | General PC audio content may overlap; no exact headset-mic page found | Low / medium | Distinct OS-level task from in-app Discord setup; demand unverified |
| 23 | `공유기 변경 후 프린터 Wi-Fi 재연결` | U; no valid exact observation | NOT_SAMPLED | No exact printer page found; no prior exact review found | Low / high | Distinct task, but highly model-specific; demand unverified |
| 24 | `아이폰 HEIC 사진 Windows 가져오기` — open/import HEIC photos on PC | U; no valid exact observation | NOT_SAMPLED | Existing Windows and file-format guides need a semantic check; no exact HEIC title found | Low-medium / medium | Distinct task possible; demand unverified |
| 25 | `USB 메모리 읽기 전용 해제` — diagnose a read-only drive safely | U; no valid exact observation | NOT_SAMPLED | Windows USB installation page is a different task; no exact page found | Low, data-loss risk / medium | Distinct task; safety caveats needed; demand unverified |
| 26 | `스캔 PDF 글자 선택 안 됨` — recognize text in an image-only PDF | U; no valid exact observation | NOT_SAMPLED | Existing PDF and utility inventory needs a semantic check; no exact OCR title found | Low-medium, privacy / medium | Distinct task possible; demand unverified |
| 27 | `화상회의 노트북 카메라 인식 안 됨` | U; no valid exact observation | NOT_SAMPLED | No exact webcam page found; no prior exact review found | Low, privacy / medium | Distinct task; demand unverified |
| 28 | `Windows 클립보드 기록 안 남음` — restore clipboard history | U; no valid exact observation | NOT_SAMPLED | No exact clipboard-history page found | Low / low-medium | Distinct task; demand unverified |
| 29 | `Android 앱 알림이 오지 않음` — diagnose per-app notification settings | U; no valid exact observation | NOT_SAMPLED | No exact notification troubleshooting page found | Low / medium | Distinct task; Android menus vary; demand unverified |
| 30 | `PC 게임 헤드폰 변경 후 소리 출력 안 됨` — route game sound to the new output | U; no valid exact observation | NOT_SAMPLED | General Windows audio and game setup may overlap; no exact route-selection page found | Low / medium | Distinct audio-routing task; demand unverified |

### Live SERP shortlist (five)

1. **인천공항 교통약자 우대출구** — Search Ads records 300/month, `HIGH`, score-valid, checked 2026-10-08. The official airport page states eligibility, required proof, T1/T2 exits, and operating hours, so the exact task is already answered authoritatively. No safe content gap was found. [Official Incheon Airport service page](https://www.airport.kr/ap_ko/908/subview.do).
2. **애견동반 캠핑장** — the result set includes Korea Tourism Organization's GoCamping directory, pet-specific directories, and booking/listing results. GoCamping says operators should be contacted because listed details can differ from on-site conditions. The exact Search Ads row has a numeric 12,780/month but `LOW` confidence and an invalid score, so this is not verified demand. Maintenance would be high because pet limits and fees change per property. [GoCamping listing](https://gocamping.or.kr/bsite/camp/info/read.do?c_no=101858&listOrdrTrget=last_updusr_pnttm), [pet-campsite directory result](https://naturestay.kr/pet-camping/%EB%B6%80%EC%82%B0%EA%B4%91%EC%97%AD%EC%8B%9C).
3. **겨울글램핑장추천** — results include a recent winter checklist and general glamping booking guides. The exact master row has no verified monthly volume; adjacent `겨울글램핑` is a `LOW`/invalid 590 estimate. The site already has a nationwide glamping list and guide, so this is both weak demand evidence and high overlap. [Winter heating checklist result](https://stonedr.tistory.com/191), [recent glamping booking guide](https://travelkoreatoday.co.kr/glamping-beginner-guide-vs-camping/).
4. **Steam Cloud conflict** — Steam Support says the conflict appears when local and cloud files differ and tells users to compare timestamps and progress before choosing. Community reports demonstrate the problem qualitatively, but no volume observation exists. Official guidance directly covers the core task; backup-before-selection framing could add value, but would need exact demand evidence and careful save-loss wording. [Steam Support](https://help.steampowered.com/en/faqs/view/68D2-35AB-09A9-7678).
5. **Galaxy USB file transfer** — Samsung's FAQ provides the steps to unlock the phone, allow data access, and select File Transfer/Android Auto; it also notes menus vary by model/software. The SERP is dominated by device-maker support and generic troubleshooting, and no demand sample was found. [Samsung Support](https://www.samsungsvc.co.kr/solution/40312).

## Demand and decision counts

- **30** distinct task candidates screened.
- **4** exact candidates in that pool have valid `HIGH`, score-valid Naver Search Ads estimates: airport priority exit (300/mo), package-tour comparison sites (300/mo), honeymoon costs (500/mo), and overseas purchasing-agency shopping sites (270/mo). Check dates are 2026-10-08, 2026-10-03, 2026-10-07, and 2026-10-07 respectively. These are query-volume observations, not traffic or revenue forecasts.
- Pet-friendly campsites have only a low-confidence raw estimate; winter glamping has no valid exact-query estimate. Both remain unverified.
- **0** candidates satisfy all launch conditions after demand, distinct-intent, SERP gap, overlap, YMYL, and maintenance checks.
- TOP 1: `NONE`. Implementation brief: `N/A`. `READY_FOR_NEW_CONTENT_REVIEW=NO`.

## Validation and storage

- Existing `adsense-latest.json`, performance files, page scores, derived measurement publisher, and `keyword_clusters.json` were untouched.
- The queue remains one bounded `*-latest.json` replacement. No dated history artifact or raw report was added. One short markdown decision record was added for Control Tower review.
- No content HTML, sitemap, published manifest, publication counter, workflow file, API dispatch, external publication, or merge occurred.
- Exact closed topics from the task prompt were not re-analyzed: Japan travel checklist, Cheongju camping CTR, Palworld OBSERVING, URL Encoder, and prior YMYL/HOLD topics. The sitewide GSC 230-row audit was not repeated.
- Source of current measured query rows: `data/keywords_master.csv`, using `search_ads_checked_at` rather than the globally refreshed `last_checked` field. No new Search Ads or Keyword Hunter API request was made.
- The official airport query initially matched the substring `대출` inside `우대출구`. The policy now masks only that fixed phrase; the loan signal remains active for actual loan queries. A candidate-specific HOLD keeps this query out of the auto-authorized queue because the official page leaves no evidenced gap.
- CODEX 2 overlap: none. No shared CODEX 2 files or data were edited.

## Source checks

- [Incheon Airport — priority exit service](https://www.airport.kr/ap_ko/908/subview.do)
- [Korea Tourism Organization GoCamping](https://gocamping.or.kr/bsite/camp/info/read.do?c_no=101858&listOrdrTrget=last_updusr_pnttm)
- [NatureStay pet campsite directory](https://naturestay.kr/pet-camping/%EB%B6%80%EC%82%B0%EA%B4%91%EC%97%AD%EC%8B%9C)
- [Winter camping and glamping heating checklist](https://stonedr.tistory.com/191)
- [Glamping beginner guide and booking checklist](https://travelkoreatoday.co.kr/glamping-beginner-guide-vs-camping/)
- [Steam Support — Steam Cloud](https://help.steampowered.com/en/faqs/view/68D2-35AB-09A9-7678)
- [Samsung Support — Galaxy folder not visible on PC](https://www.samsungsvc.co.kr/solution/40312)
