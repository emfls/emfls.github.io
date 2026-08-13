# 크롤링됨·현재 미색인 페이지 점검 — 2026-08-13

## Search Console 현황

Search Console 페이지 보고서의 최종 업데이트는 2026-08-07이다.

| 제외 사유 | URL 수 | 처리 판단 |
|---|---:|---|
| 크롤링됨 - 현재 색인이 생성되지 않음 | 16 | 최신 개선 여부와 검색 가치에 따라 선별 재요청 |
| 리디렉션이 포함된 페이지 | 3 | 정상 리디렉션이면 요청하지 않음 |
| 적절한 표준 태그가 포함된 대체 페이지 | 2 | 정상 중복 처리이면 요청하지 않음 |
| 찾을 수 없음(404) | 1 | 삭제 의도와 내부 링크 잔존 여부를 별도 확인 |

## 크롤링 후 미색인 16개

1. `/util/EasyLetterWordCounter/`
2. `/game/FlappyDot`
3. `/jp/util/unitconverter/`
4. `/game/BlockBreaker/index.html`
5. `/game/MatrixDefense/`
6. `/kor/report/travel/australia-sydney.html`
7. `/kor/report/mabinogi-auto-gather-guide.html`
8. `/kor/report/travel/austria-bludenz.html`
9. `/jp/util/thumbnailgrabber/`
10. `/kor/report/camp/gimje.html`
11. `/jp/util/dataconvert/`
12. `/kor/report/travel/austria-bruck.html`
13. `/kor/report/travel/australia-wagga.html`
14. `/util/ImageCompressor/`
15. `/kor/report/visa/uganda.html`
16. `/kor/report/camp/bucheon.html`

## 오늘 우선 처리

| URL | Search Console의 마지막 크롤링 | 실제 최신 개선 | 처리 결과 |
|---|---|---|---|
| `/kor/report/travel/australia-sydney.html` | 2026-04-07 | 2026-08-11 | 색인 요청 완료 |
| `/kor/report/visa/uganda.html` | 2026-02-22 | 2026-08-12 | 색인 요청 완료 |
| `/kor/report/camp/gimje.html` | 2026-03-15 | 2026-08-11 | 색인 요청 완료 |

세 URL 모두 우선순위 크롤링 대기열 추가 성공 메시지를 확인했다. 기존 판정은 최신 개선 전 페이지를 크롤링한 결과이므로 재크롤링 가치가 높다고 판단했다.

## 다음 처리 순서

1. `/kor/report/camp/bucheon.html`: 2026-08-11 개선분 재크롤링 요청 후보
2. `/util/EasyLetterWordCounter/`, `/util/ImageCompressor/`: 도구 검색 의도·canonical·내부 링크 점검 후 요청
3. 일본어 도구 3개: 일본어 허브 연결과 중복 canonical 확인 후 요청
4. 오스트리아·호주 지역 여행 3개: 실제 검색 수요가 없으면 재요청보다 통합 또는 색인 제외 검토
5. 게임 페이지: 광고 비활성·canonical 상태를 확인하되 수익 우선순위에서는 후순위

수동 요청은 색인을 보장하지 않는다. 2026-08-20 이후 재크롤링·색인 여부를 확인하며, 같은 URL의 반복 요청은 하지 않는다.
