"""
SEC EDGAR 10-K/10-Q 자동 페이지 생성기
EDGAR API → Jinja2 템플릿 → HTML
"""
import json
import time
import re
import requests
from datetime import datetime
from pathlib import Path
from jinja2 import Template

SITE_URL = "https://emfls.com"
REPO_ROOT = Path(__file__).parent.parent
OUTPUT_DIR = REPO_ROOT / "report/sec"
TEMPLATE_PATH = REPO_ROOT / "scripts/templates/sec_filing.html"
DATA_PATH = REPO_ROOT / "scripts/data/sec_companies.json"
DAILY_LIMIT = 30

HEADERS = {"User-Agent": "emfls.com qordltkr124@gmail.com"}
EDGAR_BASE = "https://data.sec.gov"
EDGAR_SUBMISSIONS = f"{EDGAR_BASE}/submissions"


def fmt_usd(value):
    if value is None:
        return "N/A"
    try:
        v = float(value)
        if abs(v) >= 1e12:
            return f"${v/1e12:.2f}T"
        if abs(v) >= 1e9:
            return f"${v/1e9:.2f}B"
        if abs(v) >= 1e6:
            return f"${v/1e6:.2f}M"
        return f"${v:,.0f}"
    except Exception:
        return "N/A"


def fmt_pct(value):
    if value is None:
        return "N/A"
    try:
        return f"{float(value):.1f}%"
    except Exception:
        return "N/A"


def get_submissions(cik: str) -> dict:
    url = f"{EDGAR_SUBMISSIONS}/CIK{cik}.json"
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.raise_for_status()
    return r.json()


def get_recent_filing(submissions: dict, form_types=("10-K", "10-Q")):
    """최신 10-K 또는 10-Q 하나 반환."""
    recent = submissions["filings"]["recent"]
    forms = recent["form"]
    dates = recent["filingDate"]
    accessions = recent["accessionNumber"]
    docs = recent["primaryDocument"]
    periods = recent.get("reportDate", [""] * len(forms))

    for i, form in enumerate(forms):
        if form in form_types:
            return {
                "form_type": form,
                "filing_date": dates[i],
                "accession": accessions[i].replace("-", ""),
                "primary_doc": docs[i],
                "period": periods[i] if i < len(periods) else "",
            }
    return None


def get_xbrl_facts(cik: str) -> dict:
    """XBRL 재무데이터 조회."""
    url = f"{EDGAR_BASE}/api/xbrl/companyfacts/CIK{cik}.json"
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return {}


def extract_fact(facts: dict, concept: str, unit: str = "USD"):
    """가장 최근 연간 또는 분기 값 추출."""
    try:
        entries = facts["facts"]["us-gaap"][concept]["units"][unit]
        # 연간(10-K) 우선, 없으면 분기(10-Q)
        annual = [e for e in entries if e.get("form") in ("10-K", "10-Q") and e.get("val") is not None]
        if annual:
            return annual[-1]["val"]
    except (KeyError, IndexError):
        pass
    return None


def extract_eps(facts: dict) -> str:
    """EPS 추출 (diluted 우선)."""
    for concept in ("EarningsPerShareDiluted", "EarningsPerShareBasic"):
        try:
            entries = facts["facts"]["us-gaap"][concept]["units"]["USD/shares"]
            recent = [e for e in entries if e.get("form") in ("10-K", "10-Q")]
            if recent:
                v = recent[-1]["val"]
                return f"${float(v):.2f}"
        except (KeyError, IndexError):
            pass
    return "N/A"


def extract_gross_margin(facts: dict) -> str:
    """매출총이익률 계산."""
    try:
        rev = extract_fact(facts, "Revenues") or extract_fact(facts, "RevenueFromContractWithCustomerExcludingAssessedTax")
        gp = extract_fact(facts, "GrossProfit")
        if rev and gp and rev > 0:
            return fmt_pct(gp / rev * 100)
    except Exception:
        pass
    return "N/A"


def make_slug(company: dict, filing: dict) -> str:
    name_part = re.sub(r"[^a-z0-9]+", "-", company["ticker"].lower())
    period_part = filing["period"].replace("-", "")[:6] if filing["period"] else "recent"
    return f"{name_part}-{filing['form_type'].lower().replace('-','')}-{period_part}"


def build_related(all_companies: list, current_ticker: str, current_sector: str, generated_slugs: dict, n: int = 6) -> list:
    """같은 섹터 우선 관련 기업 목록."""
    same = [c for c in all_companies if c["sector"] == current_sector and c["ticker"] != current_ticker]
    others = [c for c in all_companies if c["sector"] != current_sector and c["ticker"] != current_ticker]

    result = []
    for c in (same + others)[:n]:
        slug = generated_slugs.get(c["ticker"])
        if slug:
            result.append({
                "slug": slug,
                "name": c["name"],
                "form_type": generated_slugs.get(c["ticker"] + "_form", ""),
                "period": generated_slugs.get(c["ticker"] + "_period", ""),
                "sector": c["sector"],
            })
    return result[:n]


def generate_page(company: dict, filing: dict, facts: dict, template_str: str, slug: str) -> str:
    cik_padded = company["cik"]
    accession_fmt = filing["accession"]
    sec_url = f"https://www.sec.gov/Archives/edgar/data/{cik_padded.lstrip('0')}/{accession_fmt}/{filing['primary_doc']}"

    revenue = fmt_usd(
        extract_fact(facts, "Revenues")
        or extract_fact(facts, "RevenueFromContractWithCustomerExcludingAssessedTax")
        or extract_fact(facts, "SalesRevenueNet")
    )
    net_income = fmt_usd(extract_fact(facts, "NetIncomeLoss"))
    total_assets = fmt_usd(extract_fact(facts, "Assets"))
    op_cf = fmt_usd(extract_fact(facts, "NetCashProvidedByUsedInOperatingActivities"))

    ctx = {
        "company_name": company["name"],
        "ticker": company["ticker"],
        "cik": company["cik"],
        "sector": company["sector"],
        "form_type": filing["form_type"],
        "filing_date": filing["filing_date"],
        "period": filing["period"] or "Recent",
        "slug": slug,
        "sec_url": sec_url,
        "revenue": revenue,
        "net_income": net_income,
        "eps": extract_eps(facts),
        "total_assets": total_assets,
        "operating_cash_flow": op_cf,
        "gross_margin": extract_gross_margin(facts),
        "updated_date": datetime.now().strftime("%Y-%m-%d"),
        "related_filings": [],  # filled in second pass
    }
    return Template(template_str).render(**ctx)


def gen_index(companies_meta: list):
    """SEC 인덱스 페이지 생성."""
    today = datetime.now().strftime("%B %d, %Y")
    output_path = OUTPUT_DIR / "index.html"

    # 섹터별 그룹
    sectors: dict[str, list] = {}
    for m in companies_meta:
        sectors.setdefault(m["sector"], []).append(m)

    sector_html = ""
    for sector, items in sorted(sectors.items()):
        cards = "".join(
            f'<div class="card"><a href="{m["slug"]}.html">{m["name"]} ({m["ticker"]})</a>'
            f'<div class="meta">{m["form_type"]} · {m["period"]}</div></div>'
            for m in items
        )
        if cards:
            sector_html += f'<div class="section"><h2>🏢 {sector}</h2><div class="grid">{cards}</div></div>'

    html = f"""<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
    <title>SEC 10-K & 10-Q Filings Analysis | S&P 500 Annual & Quarterly Reports</title>
    <meta name="description" content="Latest SEC 10-K annual reports and 10-Q quarterly reports for S&P 500 companies. Apple, Microsoft, Amazon, Google, NVIDIA and more. Key financials at a glance."/>
    <meta name="keywords" content="SEC filings,10-K annual report,10-Q quarterly report,S&P500 earnings,EDGAR filings,Apple 10-K,Microsoft 10-Q"/>
    <link rel="canonical" href="{SITE_URL}/report/sec/index.html"/>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-QP5Q67GE5B"></script>
    <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','G-QP5Q67GE5B');</script>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8830524482034754" crossorigin="anonymous"></script>
    <style>
        *{{margin:0;padding:0;box-sizing:border-box;}}
        body{{font-family:'Segoe UI',sans-serif;background:#f8f9fa;color:#333;line-height:1.6;}}
        .container{{max-width:1100px;margin:0 auto;padding:20px;}}
        header{{background:linear-gradient(135deg,#0d47a1,#1976d2);color:white;text-align:center;padding:50px 20px;border-radius:12px;margin-bottom:30px;}}
        header h1{{font-size:2rem;margin-bottom:8px;}}
        header p{{opacity:.85;}}
        .section{{background:white;border-radius:10px;padding:25px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,.07);}}
        .section h2{{font-size:1.15rem;color:#0d47a1;border-bottom:2px solid #e3f2fd;padding-bottom:8px;margin-bottom:16px;}}
        .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;}}
        .card{{background:#f3f6fc;border-radius:8px;padding:14px 16px;border-left:4px solid #1976d2;}}
        .card a{{text-decoration:none;color:#0d47a1;font-weight:600;font-size:.95rem;}}
        .card .meta{{font-size:.78rem;color:#888;margin-top:4px;}}
        .breadcrumb{{font-size:.82rem;color:#888;margin-bottom:16px;}}
        .breadcrumb a{{color:#1976d2;text-decoration:none;}}
        footer{{text-align:center;padding:20px;color:#999;font-size:.8rem;}}
    </style>
</head>
<body>
<div class="container">
    <div class="breadcrumb"><a href="{SITE_URL}">Home</a> &rsaquo; SEC Filings</div>
    <header>
        <h1>📋 SEC Filings Analysis</h1>
        <p>10-K Annual & 10-Q Quarterly Reports | S&P 500 Companies | {today}</p>
    </header>
    {sector_html}
    <footer><p>Data sourced from SEC EDGAR. For informational purposes only. © 2025 Itagi | <a href="{SITE_URL}" style="color:#1976d2;">emfls.com</a></p></footer>
</div>
</body>
</html>"""
    output_path.write_text(html, encoding="utf-8")
    print(f"  [index] SEC 인덱스 생성: {len(companies_meta)}개 회사")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with open(DATA_PATH, encoding="utf-8") as f:
        companies = json.load(f)
    with open(TEMPLATE_PATH, encoding="utf-8") as f:
        template_str = f.read()

    generated = []
    skipped = 0
    companies_meta = []

    for company in companies:
        if len(generated) >= DAILY_LIMIT:
            print(f"일일 한도({DAILY_LIMIT}개) 도달.")
            break

        try:
            subs = get_submissions(company["cik"])
            filing = get_recent_filing(subs)
            if not filing:
                print(f"  [스킵] {company['ticker']}: 10-K/10-Q 없음")
                continue

            slug = make_slug(company, filing)
            out_path = OUTPUT_DIR / f"{slug}.html"

            if out_path.exists():
                skipped += 1
                # 메타 수집 (인덱스용)
                companies_meta.append({
                    "ticker": company["ticker"],
                    "name": company["name"],
                    "sector": company["sector"],
                    "slug": slug,
                    "form_type": filing["form_type"],
                    "period": filing["period"],
                })
                continue

            print(f"  → {company['ticker']} ({company['name']}) {filing['form_type']} 조회 중...")
            facts = get_xbrl_facts(company["cik"])
            time.sleep(0.3)  # EDGAR rate limit 준수

            html = generate_page(company, filing, facts, template_str, slug)
            out_path.write_text(html, encoding="utf-8")
            generated.append(f"{SITE_URL}/report/sec/{slug}.html")

            companies_meta.append({
                "ticker": company["ticker"],
                "name": company["name"],
                "sector": company["sector"],
                "slug": slug,
                "form_type": filing["form_type"],
                "period": filing["period"],
            })
            print(f"  ✓ {slug}.html 생성")

        except Exception as e:
            print(f"  [오류] {company['ticker']}: {e}")

        time.sleep(0.2)

    # 인덱스 페이지 생성
    if companies_meta:
        gen_index(companies_meta)

    print(f"\n완료: {len(generated)}개 생성, {skipped}개 이미 존재")

    # new_urls.txt 업데이트
    if generated:
        new_urls_path = REPO_ROOT / "scripts/new_urls.txt"
        with open(new_urls_path, "a", encoding="utf-8") as f:
            f.write("\n".join(generated) + "\n")
        print(f"새 URL {len(generated)}개 → scripts/new_urls.txt 저장")

    return generated


if __name__ == "__main__":
    main()
