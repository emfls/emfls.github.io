# 검색 트렌드 신호 연동

## 목적

외부 콘텐츠 후보를 만들기 전에 다음 세 종류의 신호를 분리해 저장한다.

- TrendRadar: 여러 플랫폼에서 반복 노출되는 화제. `OBSERVED_SEARCH_SIGNAL`로만 사용한다.
- 네이버 데이터랩: 네이버 통합검색의 상대 검색 추이. `VERIFIED_SEARCH_DATA`로 사용한다.
- Google Trends: 공식 API 접근 권한이 생기기 전까지 `NOT_CONNECTED`를 유지한다.

어떤 소스도 절대 검색량을 제공하지 않으면 검색량 숫자를 생성하지 않는다. TrendRadar 순위와 네이버 상대지수는 검색량이 아니다.

## TrendRadar 연결

[sansan0/TrendRadar](https://github.com/sansan0/TrendRadar)는 GPL-3.0 프로젝트이므로 소스 코드를 이 저장소에 복사하지 않는다. TrendRadar를 별도 환경에서 실행하고 생성된 `output/news/YYYY-MM-DD.db` 경로만 전달한다.

```bash
python3 scripts/search_trend_signals.py \
  --root . \
  --run-at "$(date -Iseconds)" \
  --config data/search-trend-keywords.json \
  --trendradar-db /path/to/TrendRadar/output/news/YYYY-MM-DD.db
```

어댑터는 TrendRadar의 `news_items` 테이블에서 제목, 플랫폼, 순위, 관찰 횟수와 원문 URL만 읽는다. DB가 없거나 읽을 수 없으면 `INSUFFICIENT_DATA`로 종료한다.

## 네이버 데이터랩 연결

GitHub Actions 저장소 Secret에 다음 두 값을 설정한다.

- `NAVER_DATALAB_CLIENT_ID`
- `NAVER_DATALAB_CLIENT_SECRET`

현재 저장소에는 두 Secret이 없으므로 상태는 `NOT_CONNECTED`다. 네이버 개발자센터에서 애플리케이션과 키를 생성하는 작업은 별도 승인이 필요한 외부 계정 변경이다.

## 산출물

- 기계 판독 데이터: `data/search-trend-signals.json`
- 운영 보고서: `reports/search-trend-signals.md`
- 키워드 설정: `data/search-trend-keywords.json`

트렌드 신호는 후보 발굴과 조사 우선순위에만 사용한다. `SAME_INTENT` 검사, 공식 출처 조사, Opportunity/Quality 기준을 통과하지 않은 후보는 자동 발행하지 않는다.
