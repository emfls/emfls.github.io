"""
기존 페이지 품질 점검기
1. 기존 HTML 페이지에서 키워드/타이틀 추출
2. pytrends로 키워드 수요 확인
3. GA CSV 데이터(선택)와 대조해 "수요 있지만 성과 낮은 페이지" 진단
4. 진단 리포트를 scripts/health_report.json + health_report.md 로 저장

사용법:
  python3 scripts/page_health_check.py
  python3 scripts/page_health_check.py --ga-csv /path/to/ga_export.csv
"""
import json
import time
import re
import argparse
import csv
from pathlib import Path
from datetime import datetime
from html.parser import HTMLParser

from pytrends.request import TrendReq

REPO_ROOT = Path(__file__).parent.parent
REPORT_JSON = REPO_ROOT / "scripts/health_report.json"
REPORT_MD   = REPO_ROOT / "scripts/health_report.md"

# 점검할 디렉토리 → 대표 키워드 추출 규칙
SCAN_DIRS = [
    {"dir": "kor/report/camp",       "category": "camping",  "sample": 30},
    {"dir": "kor/report/finance",    "category": "finance",  "sample": 20},
    {"dir": "kor/report/travel",     "category": "travel",   "sample": 20},
    {"dir": "kor/report/stock/us",   "category": "finance",  "sample": 20},
    {"dir": "report/crypto",         "category": "finance",  "sample": 10},
]

# 성과 낮은 기준 (GA 데이터 있을 때)
LOW_PAGEVIEW_THRESHOLD = 10   # 30일 PV 10 미만
HIGH_BOUNCE_THRESHOLD  = 80   # 이탈률 80% 초과


class TitleDescParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.description = ""
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        if tag == "title":
            self._in_title = True
        if tag == "meta":
            attrs_d = dict(attrs)
            if attrs_d.get("name", "").lower() == "description":
                self.description = attrs_d.get("content", "")[:200]

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data.strip()


def extract_meta(html_path):
    try:
        content = html_path.read_text(encoding="utf-8", errors="ignore")[:4000]
        parser = TitleDescParser()
        parser.feed(content)
        return parser.title[:120], parser.description[:200]
    except Exception:
        return "", ""


def keyword_from_title(title):
    # 타이틀에서 "|", "—", "·" 이전 첫 번째 부분을 키워드로 사용
    for sep in ["|", "—", "·", "-"]:
        if sep in title:
            return title.split(sep)[0].strip()
    return title.strip()


def load_ga_csv(csv_path):
    """GA 내보내기 CSV에서 경로별 세션/이탈률 로드"""
    ga_data = {}
    try:
        with open(csv_path, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                # 컬럼명이 다양할 수 있어 유연하게 처리
                path = (row.get("페이지 경로 및 화면 클래스") or
                        row.get("Page path and screen class") or
                        row.get("페이지 경로") or "")
                views = row.get("조회수") or row.get("Views") or row.get("페이지뷰수") or "0"
                bounce = row.get("이탈률") or row.get("Bounce rate") or "0"
                if path:
                    try:
                        views_int = int(str(views).replace(",", ""))
                        bounce_f = float(str(bounce).replace("%", "").replace(",", "."))
                        ga_data[path] = {"views": views_int, "bounce": bounce_f}
                    except Exception:
                        pass
    except Exception as e:
        print(f"  [GA CSV 오류] {e}")
    return ga_data


def get_trend_interest(pytrends, keywords, geo="KR"):
    """키워드 리스트의 12개월 평균 관심도 반환"""
    results = {}
    batch_size = 5
    for i in range(0, len(keywords), batch_size):
        batch = keywords[i:i+batch_size]
        try:
            pytrends.build_payload(batch, cat=0, timeframe="today 12-m", geo=geo)
            time.sleep(3)
            df = pytrends.interest_over_time()
            if df.empty:
                for kw in batch:
                    results[kw] = 0
            else:
                for kw in batch:
                    if kw in df.columns:
                        results[kw] = round(float(df[kw].mean()), 1)
                    else:
                        results[kw] = 0
        except Exception as e:
            print(f"  [Trends 오류] {e}")
            for kw in batch:
                results[kw] = -1
            time.sleep(30)
        time.sleep(4)
    return results


def diagnose(title, desc, trend_score, ga_views, ga_bounce, page_url):
    issues = []
    suggestions = []

    # 1. 타이틀 길이
    if len(title) < 20:
        issues.append("타이틀이 너무 짧음")
        suggestions.append("타이틀을 40~60자로 늘려 핵심 키워드를 포함하세요")
    if len(title) > 70:
        issues.append("타이틀이 너무 김 (70자 초과)")
        suggestions.append("타이틀을 60자 이내로 압축하세요")

    # 2. 메타 디스크립션
    if len(desc) < 50:
        issues.append("메타 디스크립션 너무 짧음")
        suggestions.append("메타 디스크립션을 120~160자로 작성하세요")

    # 3. 트렌드 수요 있는데 성과 낮음
    if trend_score >= 30 and ga_views is not None and ga_views < LOW_PAGEVIEW_THRESHOLD:
        issues.append(f"검색 수요 있음(trend={trend_score}) 그러나 PV={ga_views} 매우 낮음")
        suggestions.append("내부 링크 강화, 타이틀/디스크립션 개선, 콘텐츠 품질 점검 필요")

    # 4. 이탈률 높음
    if ga_bounce is not None and ga_bounce > HIGH_BOUNCE_THRESHOLD:
        issues.append(f"이탈률 높음 ({ga_bounce:.0f}%)")
        suggestions.append("콘텐츠가 검색 의도를 충족하는지 확인, 관련 내부 링크 추가")

    # 5. 트렌드 수요 없는 페이지
    if trend_score == 0 and ga_views is not None and ga_views < 5:
        issues.append("키워드 수요도 낮고 방문자도 없음")
        suggestions.append("페이지 방향 재검토 또는 키워드 변경 고려")

    severity = "🔴 심각" if len(issues) >= 3 else "🟡 개선필요" if len(issues) >= 1 else "🟢 정상"
    return {"severity": severity, "issues": issues, "suggestions": suggestions}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ga-csv", help="GA 내보내기 CSV 파일 경로", default=None)
    parser.add_argument("--skip-trends", action="store_true", help="pytrends 요청 건너뛰기")
    args = parser.parse_args()

    print("=" * 55)
    print("🔍 페이지 품질 점검 시작")
    print("=" * 55)

    # GA 데이터 로드
    ga_data = {}
    if args.ga_csv:
        ga_data = load_ga_csv(args.ga_csv)
        print(f"GA 데이터: {len(ga_data)}개 경로 로드")
    else:
        # 기본 경로에서 자동 탐색
        default_paths = list(Path("/Users/whitesmile/Downloads").glob("*페이지*.csv"))
        if default_paths:
            ga_data = load_ga_csv(default_paths[-1])
            print(f"GA 데이터 자동 로드: {default_paths[-1].name} ({len(ga_data)}개)")

    # pytrends 초기화
    pytrends = None
    if not args.skip_trends:
        try:
            pytrends = TrendReq(hl="ko", tz=540, retries=3, backoff_factor=1.5)
            print("pytrends 연결 완료")
        except Exception as e:
            print(f"pytrends 초기화 실패: {e}")

    # 페이지 수집
    all_pages = []
    for scan in SCAN_DIRS:
        scan_dir = REPO_ROOT / scan["dir"]
        if not scan_dir.exists():
            continue
        files = [f for f in scan_dir.glob("*.html") if f.name != "index.html"]
        # 샘플링
        files = sorted(files)[:scan["sample"]]
        for f in files:
            title, desc = extract_meta(f)
            kw = keyword_from_title(title)
            rel_path = "/" + str(f.relative_to(REPO_ROOT))
            all_pages.append({
                "path": rel_path,
                "file": str(f),
                "category": scan["category"],
                "title": title,
                "desc": desc,
                "keyword": kw[:50],
            })

    print(f"\n총 {len(all_pages)}개 페이지 점검 대상")

    # pytrends 조회
    trend_results = {}
    if pytrends and all_pages:
        keywords = list({p["keyword"] for p in all_pages if p["keyword"]})
        print(f"\n[Trends] {len(keywords)}개 키워드 조회 중...")
        trend_results = get_trend_interest(pytrends, keywords[:50])  # 최대 50개

    # 진단
    report = []
    for page in all_pages:
        kw = page["keyword"]
        trend_score = trend_results.get(kw, -1)

        ga_info = ga_data.get(page["path"], {})
        ga_views = ga_info.get("views")
        ga_bounce = ga_info.get("bounce")

        diag = diagnose(page["title"], page["desc"], trend_score, ga_views, ga_bounce, page["path"])

        report.append({
            "path": page["path"],
            "title": page["title"],
            "keyword": kw,
            "trend_score": trend_score,
            "ga_views": ga_views,
            "ga_bounce": ga_bounce,
            "category": page["category"],
            **diag,
        })

    # 정렬: 심각 → 개선필요 → 정상
    def severity_key(r):
        return {"🔴 심각": 0, "🟡 개선필요": 1, "🟢 정상": 2}.get(r["severity"], 3)
    report.sort(key=severity_key)

    # JSON 저장
    with open(REPORT_JSON, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    # Markdown 리포트 생성
    today = datetime.now().strftime("%Y-%m-%d %H:%M")
    critical = [r for r in report if r["severity"] == "🔴 심각"]
    warning  = [r for r in report if r["severity"] == "🟡 개선필요"]
    ok       = [r for r in report if r["severity"] == "🟢 정상"]

    md = f"""# 페이지 품질 점검 리포트
생성일: {today} | 총 {len(report)}개 페이지

## 요약
| 상태 | 건수 |
|------|------|
| 🔴 심각 (즉시 개선 필요) | {len(critical)} |
| 🟡 개선필요 | {len(warning)} |
| 🟢 정상 | {len(ok)} |

---

## 🔴 심각 — 즉시 개선 필요
"""
    for r in critical:
        md += f"\n### {r['path']}\n"
        md += f"- **타이틀**: {r['title']}\n"
        md += f"- **키워드**: `{r['keyword']}` | 트렌드 점수: {r['trend_score']} | PV: {r['ga_views']} | 이탈률: {r['ga_bounce']}\n"
        md += "- **문제점**:\n"
        for issue in r["issues"]:
            md += f"  - {issue}\n"
        md += "- **개선 방향**:\n"
        for sug in r["suggestions"]:
            md += f"  - {sug}\n"

    md += "\n---\n\n## 🟡 개선필요\n"
    for r in warning[:20]:  # 최대 20개만
        md += f"\n### {r['path']}\n"
        md += f"- **문제점**: {', '.join(r['issues'])}\n"
        md += f"- **개선**: {', '.join(r['suggestions'])}\n"

    md += f"\n---\n_emfls.com 자동 품질 점검 | {today}_\n"

    with open(REPORT_MD, "w", encoding="utf-8") as f:
        f.write(md)

    print(f"\n{'='*55}")
    print(f"점검 완료: 🔴 심각 {len(critical)}개 | 🟡 개선필요 {len(warning)}개 | 🟢 정상 {len(ok)}개")
    print(f"리포트 저장: scripts/health_report.md")
    print(f"{'='*55}")

    # 콘솔 요약 출력
    if critical:
        print("\n🔴 즉시 개선이 필요한 페이지:")
        for r in critical[:10]:
            print(f"  {r['path']}: {', '.join(r['issues'][:2])}")

    return report


if __name__ == "__main__":
    main()
