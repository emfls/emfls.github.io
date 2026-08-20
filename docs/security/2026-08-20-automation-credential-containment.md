# 자동 발행 자격증명 차단 기록 — 2026-08-20

## 적용 결과

- 자동 글 발행, 텔레그램 봇, 쿠팡 상품 갱신, YouTube 큐 처리와 칼럼 생성 진입점을 기본 비활성화했다.
- 실행하려면 운영자가 `EMFLS_AUTOMATION_ENABLED=1`을 명시적으로 설정해야 한다.
- 쿠팡·텔레그램 자격증명은 코드의 기본값 없이 실행 시 환경변수에서만 읽는다.
- GitHub remote에 자격증명을 포함하지 않고 일반 HTTPS remote를 사용한다.
- `.env`, `.env.local`과 자동화 런타임 상태 파일을 Git에서 제외했다.
- 자격증명 패턴과 기본 차단 동작을 검사하는 회귀 테스트를 추가했다.

## 필요한 환경변수

실제 자동화를 다시 허용하기 전 별도 비밀 저장소나 로컬 환경에만 설정한다.

- `EMFLS_AUTOMATION_ENABLED`
- `COUPANG_PARTNERS_ACCESS_KEY`
- `COUPANG_PARTNERS_SECRET_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

## 계정에서 반드시 수행할 조치

코드에서 값을 제거해도 Git 과거 기록과 이전 복제본에는 남을 수 있으므로 아래 값은 노출된 것으로 간주한다.

1. GitHub Personal Access Token을 즉시 폐기하고 최근 사용 기록을 확인한다.
2. Telegram BotFather에서 기존 봇 토큰을 폐기·재발급한다.
3. Coupang Partners에서 기존 API 키를 폐기·재발급한다.
4. 재발급 값은 저장소, 문서, 채팅, 로그에 넣지 않는다.
5. 외부 스케줄러·LaunchAgent·cron에서 기존 자동 발행 실행을 중지했는지 확인한다.

## Git 기록 처리 원칙

- 토큰 폐기·재발급이 실제 보안 조치이며 기록 삭제만으로 대체할 수 없다.
- 공개 Git 기록 재작성은 모든 clone과 배포 이력에 영향을 주므로 별도 승인과 백업 없이 force-push하지 않는다.
- 새 자격증명이 발급되고 기존 값이 폐기된 뒤 기록 정리 필요성을 별도 판단한다.

## 다시 활성화하기 전 조건

- 세 서비스의 기존 자격증명 폐기 완료
- 새 자격증명의 안전한 저장 위치 확정
- 생성 기준 도메인을 `emfls.github.io`로 통일
- 신규 콘텐츠 QA와 dry-run 검증 완료
- 자동 push 범위와 승인 절차 확정
