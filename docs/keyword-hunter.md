# 네이버 중심 Keyword Hunter

영구 CSV/JSON에 검색 수요 후보와 parent-child 관계를 누적한다. 신규 콘텐츠 조사용이며 글을 자동 발행하지 않는다. Python 3.9+ 표준 라이브러리만 사용한다. 테스트에는 기존 pytest가 필요하다. macOS/Linux의 파일 잠금을 사용한다.

## 처음 실행

`emfls-site`에서 실행한다. 다른 작업 폴더에서는 스크립트 절대경로를 사용해도 된다.

```sh
python3 scripts/keyword_hunter.py --dry-run
python3 scripts/keyword_hunter.py --health-check
python3 scripts/keyword_hunter.py
# 같은 명령의 별칭
make keywords
```

`--dry-run`은 네트워크·DB·보고서·기록·잠금 파일을 전혀 변경하지 않고 리포트 미리보기를 출력한다. `--offline`은 API 없이 기존 외부 자료를 사용해 결과를 저장한다. 기본 200개, `--target 100`~`--target 500` 조정 가능. 키가 없거나 근거가 부족하면 부족분을 보고하며 가짜 검색어를 만들어 수량을 채우지 않는다. 기본적으로 환경변수를 직접 읽으며 `.env`를 자동으로 로드하지 않는다.

## API 설정

검색광고 계정에서 API 이용을 신청하고 API 키, 비밀키, 광고주 고객 ID를 발급받아 실행 환경의 비밀 저장소 또는 셸 환경변수에 등록한다. [공식 검색광고 API 문서](https://naver.github.io/searchad-apidoc/), [공식 Python 예제](https://github.com/naver/searchad-apidoc/tree/master/python-sample)를 참고한다.

- `NAVER_SEARCHAD_API_KEY`
- `NAVER_SEARCHAD_SECRET_KEY`
- `NAVER_SEARCHAD_CUSTOMER_ID`

[NAVER API HUB](https://guide.ncloud-docs.com/docs/apihub-application)에서 Application 등록 → Data Lab → 검색어 트렌드 선택 후 발급된 `NAVER_API_HUB_CLIENT_ID`, `NAVER_API_HUB_CLIENT_SECRET`을 환경변수에 설정한다. CLI는 저장소 루트의 `.env`를 자동으로 읽되 이미 export된 환경변수는 덮어쓰지 않는다. 기존 개발자센터 키 이름도 호환한다.

- `NAVER_CLIENT_ID` (권장) 또는 기존 호환명 `NAVER_DATALAB_CLIENT_ID`
- `NAVER_CLIENT_SECRET` (권장) 또는 기존 호환명 `NAVER_DATALAB_CLIENT_SECRET`
- 선택: `TREND_RADAR_DB` — 별도 실행 중인 TrendRadar의 SQLite 출력 경로. 기존 reader 재사용.

웹문서 경쟁도는 API HUB 애플리케이션에서 `Search > 웹문서 검색` 권한을 별도로 활성화해야 한다. DataLab만 선택된 키를 웹문서 API에 보내면 401/403이 발생한다. 별도 애플리케이션을 쓰려면 `NAVER_WEB_SEARCH_API_HUB_CLIENT_ID`와 `NAVER_WEB_SEARCH_API_HUB_CLIENT_SECRET`을 설정하며, 이 값이 공용 API HUB 키보다 우선한다. 401/403이면 health check는 `NAVER_WEB_SEARCH_PERMISSION: REQUIRED`를 출력하고 Search Ads·DataLab 처리는 계속한다.

검색광고는 GET `/keywordstool`, HMAC-SHA256 서명, DataLab은 기존 `collect_naver_datalab`에 예산·재시도 transport를 전달한다. 최대 5개 그룹씩 묶는다. DataLab 상대지수를 절대 검색량으로 변환하지 않는다. `<10` 검색광고 값도 정확한 수치로 간주하지 않는다.

DataLab은 `DATALAB_MONTHLY_LIMIT`(기본 50,000) 중 `DATALAB_RESERVE_RATIO`(기본 10%)를 비상 여유로 남긴다. KST 월말까지 남은 날짜와 당일 남은 2시간 실행 횟수로 실행 예산을 자동 배분하며 실제 전송된 HTTP 요청과 재시도를 `data/api_usage.json`에 월별로 누적한다. 공식 문서에 프로그램용 Usage Statistics API가 명확히 제공되지 않아 콘솔 scraping은 하지 않는다. 이 로컬 수치는 추적 기능 적용 이후 Keyword Hunter가 보낸 호출만 뜻한다.

## 구조와 탐색

- `scripts/keyword_hunter.py`: CLI, 영구 상태 읽기, 탐색·랭킹·리포트.
- `keyword_hunter_core.py`: 정규화, 동의어·의도 중복, 점수, 상태, 다양성.
- `keyword_hunter_api.py`: 공식 API와 공개 RSS, 제한된 retry.
- `keyword_hunter_site.py`: 기존 SEO PageParser 확장, 모든 공개 HTML URL/title/h1~h6 및 content-metadata target query 조사. 기존 `classify_overlap` 판정 재사용.
- `keyword_hunter_state.py`: OS 잠금, 임시파일 원자 교체와 쓰기 저널 복구.

`data/keyword_hunter_config.json`에서 후보·seed·호출 예산과 점수 가중치를 설정한다. seed 예산은 신규 테마 40%, 최근 유망 테마 30%, Winner cluster 20%, backlog 10%이며 신규 테마가 충분하면 40%를 넘길 수 있다. 각 bucket의 70%는 점수 순위, 30%는 실행별 random seed를 사용하는 novelty/diversity sampling으로 선택한다. 최근 10회 탐색은 `data/recent_exploration_history.json`에 보존한다. 같은 seed와 cluster에는 cooldown을 적용하며 Winner cluster는 재확장할 수 있다. 기본 depth 4지만 breadth를 우선하고 신규 후보의 category는 최대 20%, cluster는 최대 10%다. seed 쿼리와 관련 키워드의 계보이며 언어학적 포함 관계를 보장하는 tree는 아니다.

사람이 설명 목적으로 넣었던 `INITIAL_SITE_FIT`, `INITIAL_EXPLORATION` source와 그 하위 cluster는 production seed에서 제외한다. 신규 theme·category와 사이트에 없는 문제는 novelty 보너스를 받으며 기존 category 적합도를 탐색 전제조건으로 사용하지 않는다. 신규 후보 가운데 검색량 잠재력이 큰 항목부터 DataLab 검증 예산을 사용한다.

제외한 초기 seed root는 `data/seed_exclusions.json`에 차단 근거로만 보존하며 추천이나 점수 입력으로 사용하지 않는다. parent 관계를 여러 단계 따라가므로 과거 실행에서 생성된 후손도 production 탐색 seed와 backlog 검증에서 제외된다. category가 5개 미만처럼 20% 분산이 불가능한 실행은 후보를 허위로 늘리거나 전부 삭제하지 않고 실제 비중과 shortfall을 보고한다.

신규 seed는 매 실행 [고용노동부 공식 RSS](https://www.moel.go.kr/site/rss/rssList.do), 기존 external discovery 결과, 선택적 TrendRadar에서 유입된다. RSS는 신규 탐색과 트렌드 탐색으로 나누며 실제 상승 여부는 DataLab 검증 전까지 미확인이다. 외부 제목은 실제 관찰 자료이며 접미사 조합으로 후보를 양산하지 않는다. 새로 유입되는 자료가 없으면 신규 후보 100개에 미달할 수 있다.

최근 2회 신규 키워드가 0이거나 최근 3회 Winner가 0이면 `ZERO RESULT RECOVERY`를 켠다. 최근 10회 seed는 계속 제외하고 신규 테마 budget을 70%로 높이며, 외부에서 실제 관찰한 제목의 연속 단어만 2~3개씩 묶어 Search Ads용 짧은 seed로 사용한다. 임의 suffix는 추가하지 않는다. cooldown cluster는 재사용하지 않고 신규 category 10개 이상을 목표로 breadth를 우선한다. Winner 기준은 낮추지 않으며 최근 3회 Winner가 없으면 기존 검증 완료 행 중 상위 10개를 `CANDIDATE 10`으로 별도 표시한다.

한글 띄어쓰기/대소문자/유니코드·동의어와 문자 2-gram 유사도를 사용한다. 수치가 다른 후보를 단순 의도 중복으로 합치지 않는다. 기존 페이지와 동일 의도/높은 유사도는 `IMPROVE_EXISTING`, 중간 유사도는 `WAIT_FOR_DATA`로 신규 TOP에서 제외한다. 이 방법은 설명 가능한 보수적 휴리스틱으로 완전한 의미 이해를 보장하지 않으며 TOP5도 편집 검토가 필요하다.

## 점수와 선정

기본 가중치: 검색수요 25 / 추세 15 / 구체성 15 / 광고 경쟁 역점수 20 / 상업성 10 / 사이트 적합성 10 / 최신 정보 필요성 5. 합계로 나누어 0~100으로 계산한다. 수요는 log(1+검색량), 10,000에서 상한. 광고 경쟁도는 SEO 난이도의 대리 지표임을 명시한다. 결측 구성요소는 점수 기여 0, 원자료는 빈 값이다.

Search Ads는 절대 검색량과 광고 경쟁 지표, DataLab은 상대 추세, 웹문서 검색은 결과 문서 수를 담당한다. Search Ads와 DataLab이 있으면 점수 계산이 유효한 `MEDIUM`, 웹문서 수까지 있으면 `HIGH`, Search Ads만 있으면 `LOW`, 검색량이 없으면 `UNVERIFIED`다. 필수 수요 데이터가 없으면 `opportunity_score`는 비우고 `score_valid=false`로 저장한다.

최근 완료된 30일 평균 대비 직전 30일 / 90일 전 30일 평균의 변화율을 trend_1m/trend_3m로 저장하고, `trend_momentum`과 전년 동기 `seasonality`도 별도 저장한다. 0 기준선 또는 날짜 결측은 미확인이다. Search Ads 조회가 성공한 seed만 `last_expanded`를 기록하고 결과를 7일 동안 재사용한다. 실패하거나 API 미설정 상태였던 seed는 성공한 캐시로 취급하지 않으며, 리포트의 다음 seed에는 캐시가 만료됐거나 아직 성공하지 않은 항목만 표시한다.

TOP50은 이번 실행의 신규 비중복 키워드 중 `score_valid=true`인 항목이다. TOP20은 점수 35 이상·coverage 100인 후보, TOP5는 그중 다양성을 적용한다. `UNVERIFIED`는 TOP·콘텐츠 큐·자동 페이지 생성에 사용할 수 없다. 태그는 evergreen, trending, commercial, informational, calculator/tool, comparison, how-to, troubleshooting, checklist, current-information. 수량이 부족하면 적격 후보만 제시한다.

## 영구 파일과 상태

- `data/keywords_master.csv`: 요구된 전체 필드 + confidence·data_coverage·score_valid·추세/계절성·각 API 관측시각.
- `data/keyword_seeds.json`: 계속 확장할 seed와 마지막 확장 시각.
- `data/keyword_clusters.json`: cluster별 키워드와 parent-child edges.
- `data/rejected_keywords.json`, `data/published_keywords.json`: 재수집 차단 기록. master와 병합해 적용.
- `reports/keyword-hunter/YYYY-MM-DD-HHMM.md`: 매 실행 리포트. 같은 분 재실행은 이어 붙여 보존.
- `PROJECT_HISTORY.md`: 매 실행 짧은 기록. 항상 API 호출 전에 이전 기록/DB를 읽는다.
- `.keyword-hunter/`: 잠금·복구 저널(커밋 제외). 불필요한 raw 응답 저장 없음.

```sh
python3 scripts/keyword_hunter.py --keyword '키워드' --set-status REVIEWED
python3 scripts/keyword_hunter.py --keyword '키워드' --set-status QUEUED
python3 scripts/keyword_hunter.py --keyword '키워드' --set-status PUBLISHED --url '/kor/report/example.html'
python3 scripts/keyword_hunter.py --keyword '키워드' --set-status REJECTED
```

NEW→REVIEWED→QUEUED→PUBLISHED, NEW/REVIEWED/QUEUED→REJECTED, QUEUED→REVIEWED, REJECTED→REVIEWED 허용. PUBLISHED는 실제 로컬 사이트 URL이 있어야 한다. 기존 콘텐츠 발행 가드·28일 관찰·품질 기준은 기존 자동화에서 계속 담당한다. Hunter 점수를 발행 승인으로 사용하지 않는다.

## 무인 실행 / 2시간 Automation 프롬프트

실행 주기 설정은 **2시간마다**. 같은 로컬 체크아웃을 사용하고 위 환경변수를 실행 호스트에 설정한다. 아래 프롬프트를 사용한다.

> 현재 emfls-site 저장소의 PROJECT_HISTORY.md와 docs/keyword-hunter.md, 기존 keyword DB를 먼저 읽고 `python3 scripts/keyword_hunter.py`를 한 번 실행하라. 기존 시스템을 재구축하지 말고 신규 리포트와 영구 DB 및 짧은 실행 기록의 저장 여부를 확인하라. 질문 없이 진행하고 API 미연결·부분 실패·후보 부족은 리포트에 기록하라. 콘텐츠 발행은 별도 승인된 발행 절차를 따른다. 자동 커밋·푸시는 하지 않는다. 새로운 TOP5 또는 대응이 필요한 오류가 생겼을 때만 핵심 내용을 알리고, 상태가 동일하면 조용히 종료하라.

`.github/workflows/keyword-hunter.yml`은 2시간마다 실행하며 동일 실행의 중복을 막는다. 저장소 secrets에 Search Ads와 API HUB 키가 있어야 실제 검증값을 수집한다. 실행 후 Keyword Hunter 상태·리포트·기존 페이지 개선 후보 목록만 제한적으로 커밋하며 페이지를 자동 제작하거나 수정하지 않는다. 일반 SEO QA에서는 API 없이 dry-run만 검증한다.

## 오류 처리와 테스트

429는 최소 30초부터 exponential backoff하고, 서버의 Retry-After를 존중한다. 5분을 넘는 대기는 현재 실행에서 재호출하지 않고 실패 seed로 기록해 다음 실행으로 미룬다. 최대 3회이며 재시도도 전체 호출 예산 100회와 월·일별 동적 DataLab 예산에 포함한다. Search Ads 조회 TTL은 7일이다. 401/403은 인증 오류로, DataLab 설정 미선택도 403 원인이다. 인증 내용·응답 본문은 로그에 남기지 않는다.

DataLab은 discovery가 아니라 Search Ads Fast Filter 이후 validation에 사용한다. 신규 실측 후보, Winner 경계 후보, 신규 테마, Winner cluster, 유망 backlog 순으로 검증하고 후보 5개를 한 요청의 5개 keyword group으로 묶는다. 월 usable quota가 소진되어도 Search Ads 탐색은 계속한다. 실행 리포트에는 월 한도·사용량·잔여량·남은 날짜·일 예산·실행 예산·실제 호출·검증 키워드·평균 batch 효율을 기록한다.

Fast Filter는 Search Ads의 월간 검색량과 경쟁 지표가 있는 후보만 DataLab에 보낸다. 기본 월 검색량 바닥은 10이며 직전 통과율이 2% 미만인 recovery 실행에서만 5로 제한 완화한다. DataLab 결과가 없는 값을 검색량이나 추세로 꾸미지 않는다. 성공적으로 채워진 DataLab 값은 24시간 재조회하지 않으며, 이번 요청에 제출하지 않은 기존 행의 추세값은 보존한다. `DISCOVERY FUNNEL`은 seed pool, cooldown, Search Ads raw, 정규화, DB 중복, saturation, novelty, Fast Filter, DataLab, score validity, Candidate, Winner 수와 통과율을 기록한다. Naver web result count 수집기는 현재 없으므로 호출 수를 0으로 명시한다.

`--health-check`는 `NAVER_SEARCH_ADS`, `NAVER_DATALAB`, `NAVER_WEB_SEARCH`, `SITE_INDEX`, `EXTERNAL_RSS`를 `OK`, `NOT_CONFIGURED`, `AUTH_ERROR`, `RATE_LIMITED`, `NETWORK_ERROR`, `API_ERROR`(RSS는 `DEGRADED`)로 표시한다. 웹 검색 401/403은 `NAVER_WEB_SEARCH_PERMISSION: REQUIRED`도 표시한다. `--data-quality-only`는 신규 발굴과 API 호출 없이 기존 DB의 confidence/coverage/score_valid를 마이그레이션한다. 핵심 API 둘 다 미설정이면 UNVERIFIED 후보는 최대 20개까지만 보존하며, 핵심 API가 복구되면 기존 미검증 행부터 재조회한다.

매 실행은 `data/page-performance.json`의 `VERIFIED` 채널만 읽어 `data/existing-page-improvement-candidates.json`을 갱신한다. Google 5~30위, 충분한 노출 대비 낮은 CTR, Naver 노출 대비 낮은 CTR, 측정 트래픽이 있는 WINNER 클러스터 이웃, 트래픽 대비 구조 점수가 낮은 URL을 이유와 원측정값과 함께 저장한다. WINNER와 COOLDOWN URL은 제외하며 페이지는 수정하지 않는다.

동시 실행은 잠금으로 거절한다. 비정상 종료 후 다음 실행이 쓰기 저널을 먼저 복구한다. DB JSON/CSV 손상은 자동 초기화하지 않고 비정상 종료하므로 원본을 복구한 뒤 실행한다. 실행 자체는 수익·검색 순위 상승을 보장하지 않는다.

```sh
python3 -m pytest tests/test_keyword_hunter*.py -q
python3 -m pytest -q
python3 -m unittest discover -s tests -q
node --test tests/search_demand_tools.test.js
```
