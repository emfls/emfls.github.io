---
phase: content-launch-6c7
state: DEPLOYED
branch: main
worktree: ../emfls-phase6c7-publish-main
last_verified_commit: a918593542
last_verified_tests: "908 passed"
content_index_entries: 7199
home_feed_size: "19KB"
blockers: []
next_action: "review first launch-ready candidate"
---

# Work Status

완료: 콘텐츠 인덱스, home-feed, 블로그형 홈페이지, lazy 검색, main 최신 콘텐츠 병합, Pages 배포 검증, 관련 테스트 20 passed.

Phase 5 deployed: `/kor/**/*.html` 변경 시 인덱스를 재생성하고 테스트 통과 시에만 generated JSON을 커밋한다.

Phase 6A deployed: 최신 검증 후보를 fail-closed launch queue로 변환하고 dailyLimit=1, 중복·유사 intent·YMYL·stale 검사를 적용한다. HTML 자동 생성과 발행은 아직 수행하지 않는다.

Phase 6B deployed: validation coverage 개선, DataLab telemetry 추가, Winner/Candidate normalized dedupe, baseline cohort telemetry, YMYL launch queue 강화.

Phase 6C-1 deployed: launch 단계에서 deterministic URL을 파생하고 YMYL·중복·overlap exclusion telemetry를 분리한다. 실제 HTML 발행은 아직 수행하지 않는다.

Phase 6C-7 deployed: `영어공부하기좋은미드` 첫 supervised canary를 `/kor/column/yeongeogongbuhijoheunmideu/`에 발행했다. launch guard PASS, 관련 테스트 및 전체 pytest 908 passed. 다음 단계는 28일 observation이다.
