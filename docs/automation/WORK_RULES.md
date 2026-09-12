# emfls Work Rules

Work는 WORK_PLAN.md와 WORK_STATUS.md를 기준으로 feature 브랜치의 구현·검증을 수행한다. AGENTS.md와 상태 파일을 먼저 확인하고 필요한 범위만 읽는다. 기존 URL·canonical·GA4·AdSense·verification을 보존하며 대량 HTML은 Python으로 처리한다. 관련 테스트 통과 후 feature commit/push는 자율 진행하되 main merge/push, force push, reset/clean/stash, 사용자 파일 삭제, secrets, 계획 밖 대규모 변경은 BLOCKED로 기록한다. 의미 있는 체크포인트마다 WORK_STATUS를 갱신한다.
