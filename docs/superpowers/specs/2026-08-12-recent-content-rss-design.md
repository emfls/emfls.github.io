# Recent Content RSS Design

## Goal

기존 XML 사이트맵을 유지하면서 Google이 새로 발행되거나 최근 수정된 콘텐츠를 발견할 수 있도록 루트 `feed.xml` RSS 2.0 피드를 추가한다.

## Selected approach

정적 RSS 2.0 피드와 재생성 스크립트를 사용한다. Atom도 Google이 지원하지만 RSS 2.0은 `feed.xml`이라는 경로와 운영자가 확인하기 쉬운 `item` 구조에 잘 맞는다. 수동 목록은 갱신 누락 위험이 크므로 사용하지 않는다.

## Feed contract

- 공개 경로: `https://emfls.github.io/feed.xml`
- 형식: RSS 2.0, UTF-8
- 최대 항목: 500개
- 대상: 정확한 self-canonical과 제목을 가진 색인 대상 HTML 콘텐츠
- 제외: 404, 소유권 검증 파일, 개인정보·연락처 같은 운영 페이지, StockWiki 테스트 페이지
- 정렬: HTML의 `dateModified`, `datePublished`, 최근 확인일 메타데이터를 순서대로 사용하고 날짜가 같으면 canonical URL로 결정론적으로 정렬
- 항목: `title`, `link`, 영구 `guid`, `pubDate`, 짧은 `description`
- 채널: 사이트 제목, 루트 링크, 설명, 언어, `lastBuildDate`
- XML 특수문자는 표준 라이브러리로 안전하게 이스케이프한다.

## Discovery

- 기존 `Sitemap: https://emfls.github.io/sitemap.xml`은 유지한다.
- `robots.txt`에 `Sitemap: https://emfls.github.io/feed.xml`을 추가한다.
- 루트 홈페이지 `<head>`에 `rel="alternate"`, `type="application/rss+xml"` 발견 링크를 추가한다.
- 배포 후 Google Search Console의 사이트맵 입력란에 `feed.xml` 제출을 시도한다.

## Generator and update flow

`scripts/generate_recent_rss.py`가 저장소 HTML을 읽어 `feed.xml`을 생성한다. 새 페이지 발행 또는 대량 페이지 개선 후 이 스크립트를 다시 실행하면 피드가 갱신된다. 동일한 입력에서는 동일한 항목 순서를 유지한다.

## Validation

- 생성 단위 테스트: 날짜 우선순위, 제외 규칙, 500개 제한, XML 이스케이프
- 배포 계약 테스트: `feed.xml` 파싱 성공, 1~500개 고유 항목, 모든 링크의 `emfls.github.io` HTTPS 사용, 필수 필드 존재
- 기존 전체 pytest 실행
- 배포 후 공개 `feed.xml` HTTP 200과 대표 항목 확인

## Limitations

RSS 제출은 Google의 크롤·색인을 보장하지 않는다. 최근 URL 발견을 보조할 뿐이며, 기존 18,000여 페이지 전체를 전달하는 XML 사이트맵과 내부 링크를 대체하지 않는다. GitHub Pages 또는 Search Console 속성 수준의 가져오기 문제가 원인이라면 RSS도 동일하게 실패할 수 있으므로 제출 결과를 별도로 기록한다.
