# LadderGame canonical 오류 수정 설계

## 문제

`game/LadderGame/index.html`은 실제 공개 경로가 `/game/LadderGame/`인데 canonical을 존재하지 않는 `/LadderGame/`로 선언한다. Google은 잘못된 canonical URL을 크롤링한 뒤 404로 분류했다.

## 선택한 접근

영문 기본 LadderGame 페이지의 canonical만 실제 공개 디렉터리 URL로 교체한다. 게임 코드, 콘텐츠, 다국어 페이지, 사이트맵은 변경하지 않는다. 사이트맵은 이미 올바른 `/game/LadderGame/`를 가리키므로 수정 대상이 아니다.

## 검증

- 정적 HTML을 파싱해 canonical이 정확히 `https://emfls.github.io/game/LadderGame/`인지 확인하는 회귀 테스트를 추가한다.
- 이전의 잘못된 `/LadderGame/` canonical이 테스트에서 실패하는 것을 먼저 확인한다.
- 수정 후 집중 테스트, 전체 테스트, `git diff --check`를 실행한다.
- 메인 배포 후 공개 HTML의 canonical과 GitHub Pages 빌드 성공을 확인한다.

## 후속 조치

배포 성공 후 Search Console 404 항목에서 수정 결과 확인을 시작한다. Google 재크롤링 전까지 보고서의 404 개수는 즉시 줄지 않을 수 있다.
