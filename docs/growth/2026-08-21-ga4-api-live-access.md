# GA4 Data API 상시 조회 연결 — 2026-08-21

## 완료

- GA4 속성: `exchat-b9ce8` (`226808916`)
- 서비스 계정: `emfls-analytics@stock-blog-auto.iam.gserviceaccount.com`
- 역할: `뷰어`
- 수익 측정항목 제한: 없음
- API 범위: `analytics.readonly`
- 검증: `runReport` 응답 `200`

## 가능한 자동 분석

- 유입 소스별 방문 페이지, 세션, 참여율, 참여시간, 총수익
- 네이버·Bing·Google별 수익 URL 순위
- 기간별 페이지 성과 비교
- 표본이 작은 수익 이상치 제외

## 보안·운영 범위

- GA4 설정 편집, 사용자 관리, 데이터 삭제 권한은 없다.
- 서비스 계정 키 파일은 저장소에 복사하지 않고 로컬 경로에서만 사용한다.
- Search Console과 AdSense는 별도 권한이므로 이번 연결에 포함되지 않는다.
