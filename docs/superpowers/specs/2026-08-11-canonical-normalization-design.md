# Canonical URL Normalization Design

## Goal

모든 실제 색인 대상 HTML 페이지가 현재 GitHub Pages 주소인 `https://emfls.github.io`의 자기 자신을 정확히 하나의 canonical로 선언하도록 정리한다.

## Rules

- 일반 `.html` 페이지는 파일 경로 그대로 canonical을 사용한다.
- `index.html` 페이지는 GitHub Pages가 리디렉션하는 슬래시 종료 URL을 사용한다.
- Unicode 경로는 저장소 파일명과 같은 NFC 형태로 통일한다.
- 중복 canonical은 하나만 남기며 다른 페이지를 가리키는 오래된 canonical을 제거한다.
- 실제 콘텐츠인 StockWiki 홈과 10개 종목 페이지에는 canonical을 추가한다.
- `404.html`, Google/Naver 소유권 검증 파일, `kor/stockwiki/test/index.html`은 색인 대상이 아니므로 canonical 필수 검사에서 제외한다.
- `emfls.com`을 canonical로 선언하는 페이지가 없어야 한다.

## Verification

전체 HTML을 검사하는 회귀 테스트로 누락·중복·잘못된 호스트·자기 주소 불일치를 차단한다. 변경 후 전체 테스트를 실행하고 대표 URL의 배포 결과를 확인한다.
