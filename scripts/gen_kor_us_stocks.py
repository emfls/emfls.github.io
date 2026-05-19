"""
한국어 미국 주식 페이지 생성기
yfinance + SEC EDGAR XBRL → /kor/report/stock/us/{ticker}.html
"""
import json
import time
from datetime import datetime
from pathlib import Path
from jinja2 import Template

import sys
sys.path.insert(0, str(Path(__file__).parent))
from gen_us_stocks import (
    fetch_yfinance, get_xbrl_facts, build_context,
    build_related, HEADERS
)

SITE_URL = "https://emfls.com"
REPO_ROOT = Path(__file__).parent.parent
OUTPUT_DIR = REPO_ROOT / "kor/report/stock/us"
TEMPLATE_PATH = REPO_ROOT / "scripts/templates/kor_us_stock.html"
DATA_PATH = REPO_ROOT / "scripts/data/us_stocks.json"
DAILY_LIMIT = 30


def gen_index(companies_meta):
    today = datetime.now().strftime("%Y년 %m월 %d일")
    output_path = OUTPUT_DIR / "index.html"

    sectors = {}
    for m in companies_meta:
        sectors.setdefault(m["sector"], []).append(m)

    sector_html = ""
    for sector, items in sorted(sectors.items()):
        cards = "".join(
            f'<div class="card"><a href="{m["ticker"].lower()}.html">'
            f'{m["name"]} <span class="tkr">({m["ticker"]})</span></a>'
            f'<div class="meta">{m["sector"]} · {m["industry"]}</div></div>'
            for m in sorted(items, key=lambda x: x["ticker"])
        )
        sector_html += f'<div class="section"><h2>📊 {sector}</h2><div class="grid">{cards}</div></div>'

    html = f"""<!doctype html>
<html lang="ko">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
    <title>미국 주식 분석 2025 | 실시간 주가·재무제표·투자전략 | emfls.com</title>
    <meta name="description" content="S&P500·나스닥 150개 미국 주식 완전 분석. 애플·마이크로소프트·엔비디아·테슬라 등 실시간 주가, PER, 시가총액, SEC 재무제표를 한국어로 확인하세요."/>
    <meta name="keywords" content="미국주식,S&P500,나스닥주식,미국주식분석,애플주가,테슬라주가,엔비디아주가"/>
    <link rel="canonical" href="{SITE_URL}/kor/report/stock/us/index.html"/>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-QP5Q67GE5B"></script>
    <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','G-QP5Q67GE5B');</script>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8830524482034754" crossorigin="anonymous"></script>
    <style>
        *{{margin:0;padding:0;box-sizing:border-box;}}
        body{{font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#f0f2f5;color:#1a1a2e;line-height:1.65;}}
        .container{{max-width:1100px;margin:0 auto;padding:20px;}}
        header{{background:linear-gradient(135deg,#0a0a2e,#1a237e,#1565c0);color:white;text-align:center;padding:48px 20px;border-radius:14px;margin-bottom:22px;}}
        header h1{{font-size:1.9rem;margin-bottom:8px;}}
        header p{{opacity:.85;font-size:.95rem;}}
        .section{{background:white;border-radius:12px;padding:20px 22px;margin-bottom:14px;box-shadow:0 2px 10px rgba(0,0,0,.06);}}
        .section h2{{font-size:1rem;color:#1a237e;border-bottom:2px solid #e8eaf6;padding-bottom:7px;margin-bottom:14px;}}
        .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:9px;}}
        .card{{background:#f5f6ff;border-radius:10px;padding:11px 13px;border-left:3px solid #3f51b5;}}
        .card a{{text-decoration:none;color:#1a237e;font-weight:600;font-size:.88rem;}}
        .card a:hover{{color:#3f51b5;}}
        .tkr{{font-size:.77rem;color:#5c6bc0;}}
        .card .meta{{font-size:.73rem;color:#888;margin-top:3px;}}
        .breadcrumb{{font-size:.8rem;color:#888;margin-bottom:12px;}}
        .breadcrumb a{{color:#3f51b5;text-decoration:none;}}
        footer{{text-align:center;padding:20px;color:#999;font-size:.78rem;}}
        footer a{{color:#3f51b5;}}
    </style>
</head>
<body>
<div class="container">
    <div class="breadcrumb"><a href="{SITE_URL}">홈</a> &rsaquo; <a href="{SITE_URL}/kor/report/stock/2025/index.html">한국주식</a> &rsaquo; 미국주식</div>
    <header>
        <h1>🇺🇸 미국 주식 분석 데이터베이스</h1>
        <p>실시간 주가 · SEC 재무제표 · 애널리스트 투자의견 | {today}</p>
    </header>
    {sector_html}
    <footer><p>데이터 출처: yfinance, SEC EDGAR. 투자 권유가 아닙니다. © 2025 Itagi | <a href="{SITE_URL}">emfls.com</a></p></footer>
</div>
</body>
</html>"""
    output_path.write_text(html, encoding="utf-8")
    print(f"  [index] 한국어 미국주식 인덱스 생성: {len(companies_meta)}개 종목")


def main():
    try:
        import yfinance
    except ImportError:
        print("  [오류] yfinance가 없습니다. pip install yfinance")
        return []

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with open(DATA_PATH, encoding="utf-8") as f:
        companies = json.load(f)
    with open(TEMPLATE_PATH, encoding="utf-8") as f:
        template_str = f.read()

    template = Template(template_str)
    generated = []
    skipped = 0
    companies_meta = []
    contexts = {}

    for company in companies:
        if len(generated) >= DAILY_LIMIT:
            print(f"일일 한도({DAILY_LIMIT}개) 도달.")
            break

        ticker = company["ticker"]
        out_path = OUTPUT_DIR / f"{ticker.lower()}.html"

        companies_meta.append({
            "ticker": ticker,
            "name": company["name"],
            "sector": company.get("sector", ""),
            "industry": company.get("industry", ""),
        })

        if out_path.exists():
            skipped += 1
            continue

        try:
            print(f"  → {ticker} ({company['name']}) 한국어 조회 중...")
            info, stock_obj = fetch_yfinance(ticker)
            time.sleep(0.3)

            cik = company.get("cik", "")
            facts = get_xbrl_facts(cik) if cik else {}
            if cik:
                time.sleep(0.3)

            ctx = build_context(company, info, stock_obj, facts)
            contexts[ticker] = ctx

            html = template.render(**ctx)
            out_path.write_text(html, encoding="utf-8")
            generated.append(f"{SITE_URL}/kor/report/stock/us/{ticker.lower()}.html")
            print(f"  ✓ kor/{ticker.lower()}.html 생성")

        except Exception as e:
            print(f"  [오류] {ticker}: {e}")

        time.sleep(0.2)

    # 2nd pass: related_stocks
    existing_tickers = {c["ticker"] for c in companies_meta}
    for ticker, ctx in contexts.items():
        company = next((c for c in companies if c["ticker"] == ticker), {})
        ctx["related_stocks"] = build_related(companies, ticker, company.get("sector", ""), existing_tickers)
        out_path = OUTPUT_DIR / f"{ticker.lower()}.html"
        try:
            out_path.write_text(template.render(**ctx), encoding="utf-8")
        except Exception as e:
            print(f"  [관련주 오류] {ticker}: {e}")

    if companies_meta:
        gen_index(companies_meta)

    print(f"\n완료: {len(generated)}개 생성, {skipped}개 이미 존재")

    if generated:
        new_urls_path = REPO_ROOT / "scripts/new_urls.txt"
        with open(new_urls_path, "a", encoding="utf-8") as f:
            f.write("\n".join(generated) + "\n")
        print(f"새 URL {len(generated)}개 → scripts/new_urls.txt 저장")

    return generated


if __name__ == "__main__":
    main()
