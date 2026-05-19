"""
미국 주식 데이터베이스 페이지 생성기
yfinance (실시간 시세/재무) + SEC EDGAR XBRL (역사적 분기 데이터) → HTML
"""
import json
import time
import re
import requests
from datetime import datetime
from pathlib import Path
from jinja2 import Template

try:
    import yfinance as yf
except ImportError:
    yf = None

SITE_URL = "https://emfls.com"
REPO_ROOT = Path(__file__).parent.parent
OUTPUT_DIR = REPO_ROOT / "report/stock"
TEMPLATE_PATH = REPO_ROOT / "scripts/templates/us_stock.html"
DATA_PATH = REPO_ROOT / "scripts/data/us_stocks.json"
DAILY_LIMIT = 30

HEADERS = {"User-Agent": "emfls.com qordltkr124@gmail.com"}
EDGAR_BASE = "https://data.sec.gov"


# ──────────────────────────────────────────────
# 포맷 헬퍼
# ──────────────────────────────────────────────

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
        return f"{float(value)*100:.1f}%"
    except Exception:
        return "N/A"


def fmt_pct_raw(value):
    """값이 이미 100배된 경우 (예: yfinance dividendYield)."""
    if value is None:
        return "N/A"
    try:
        return f"{float(value):.2f}%"
    except Exception:
        return "N/A"


def fmt_num(value, decimals=2):
    if value is None:
        return "N/A"
    try:
        return f"{float(value):.{decimals}f}"
    except Exception:
        return "N/A"


def fmt_price(value):
    if value is None:
        return "N/A"
    try:
        return f"${float(value):,.2f}"
    except Exception:
        return "N/A"


def fmt_volume(value):
    if value is None:
        return "N/A"
    try:
        v = float(value)
        if v >= 1e9:
            return f"{v/1e9:.2f}B"
        if v >= 1e6:
            return f"{v/1e6:.2f}M"
        if v >= 1e3:
            return f"{v/1e3:.1f}K"
        return f"{v:,.0f}"
    except Exception:
        return "N/A"


def safe(info, *keys, default="N/A"):
    for k in keys:
        v = info.get(k)
        if v is not None and v != "" and v != 0 and v != "N/A":
            return v
    return default


# ──────────────────────────────────────────────
# SEC EDGAR XBRL
# ──────────────────────────────────────────────

def get_xbrl_facts(cik):
    if not cik:
        return {}
    url = f"{EDGAR_BASE}/api/xbrl/companyfacts/CIK{cik}.json"
    try:
        r = requests.get(url, headers=HEADERS, timeout=20)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return {}


def extract_quarterly_series(facts, concept, unit="USD", n=8):
    """최근 n개 분기 값 추출 → [(period, value), ...]"""
    try:
        entries = facts["facts"]["us-gaap"][concept]["units"][unit]
        # 분기 보고서만 (10-Q, 10-K), frame이 있는 것 우선
        quarterly = [
            e for e in entries
            if e.get("form") in ("10-Q", "10-K") and e.get("val") is not None
        ]
        # 중복 period 제거 (최신 것 유지)
        seen = {}
        for e in quarterly:
            period = e.get("end", "")
            seen[period] = e["val"]
        sorted_periods = sorted(seen.keys())[-n:]
        return [(p, seen[p]) for p in sorted_periods]
    except (KeyError, IndexError):
        return []


def build_income_table(facts):
    """분기별 Revenue, Net Income, EPS 테이블 데이터 구성."""
    rev_series = extract_quarterly_series(
        facts,
        "RevenueFromContractWithCustomerExcludingAssessedTax"
    ) or extract_quarterly_series(facts, "Revenues") or extract_quarterly_series(facts, "SalesRevenueNet")

    ni_series = extract_quarterly_series(facts, "NetIncomeLoss")

    eps_series = []
    for concept in ("EarningsPerShareDiluted", "EarningsPerShareBasic"):
        eps_series = extract_quarterly_series(facts, concept, unit="USD/shares")
        if eps_series:
            break

    # 공통 기간 집합
    all_periods = sorted(set(
        [p for p, _ in rev_series] +
        [p for p, _ in ni_series] +
        [p for p, _ in eps_series]
    ))[-8:]

    rev_map = dict(rev_series)
    ni_map = dict(ni_series)
    eps_map = dict(eps_series)

    periods = [p[:7] for p in all_periods]  # YYYY-MM

    income_rows = [
        {
            "label": "Revenue",
            "vals": [fmt_usd(rev_map.get(p)) for p in all_periods],
        },
        {
            "label": "Net Income",
            "vals": [fmt_usd(ni_map.get(p)) for p in all_periods],
        },
        {
            "label": "EPS (Diluted)",
            "vals": [
                f"${float(eps_map[p]):.2f}" if p in eps_map and eps_map[p] is not None else "N/A"
                for p in all_periods
            ],
        },
    ]
    return periods, income_rows


# ──────────────────────────────────────────────
# yfinance 데이터
# ──────────────────────────────────────────────

def fetch_yfinance(ticker):
    if yf is None:
        return {}, {}
    try:
        stock = yf.Ticker(ticker)
        info = stock.info or {}
        return info, stock
    except Exception:
        return {}, None


def build_context(company, info, stock_obj, facts):
    ticker = company["ticker"]
    sector = company.get("sector", "")
    industry = company.get("industry", "")
    name = company.get("name", ticker)

    # 가격 정보
    current_price = safe(info, "currentPrice", "regularMarketPrice")
    prev_close = safe(info, "regularMarketPreviousClose", "previousClose")
    price_change_val = None
    price_change_pct = None
    price_dir = "up"
    try:
        if current_price != "N/A" and prev_close != "N/A":
            diff = float(current_price) - float(prev_close)
            pct = diff / float(prev_close) * 100
            price_change_val = diff
            price_change_pct = pct
            price_dir = "up" if diff >= 0 else "down"
    except Exception:
        pass

    sign = "+" if (price_change_val or 0) >= 0 else ""
    if price_change_val is not None and price_change_pct is not None:
        price_change = f"{sign}${price_change_val:.2f} ({sign}{price_change_pct:.2f}%)"
    else:
        price_change = "N/A"

    # 마켓 캡
    market_cap = fmt_usd(safe(info, "marketCap", default=None))

    # 밸류에이션
    pe_trailing = fmt_num(safe(info, "trailingPE", default=None))
    pe_forward = fmt_num(safe(info, "forwardPE", default=None))
    pb_ratio = fmt_num(safe(info, "priceToBook", default=None))
    ev_ebitda = fmt_num(safe(info, "enterpriseToEbitda", default=None))
    ps_ratio = fmt_num(safe(info, "priceToSalesTrailing12Months", default=None))
    peg_ratio = fmt_num(safe(info, "pegRatio", default=None))
    beta = fmt_num(safe(info, "beta", default=None))

    # 배당 / 주가 범위
    div_yield_raw = safe(info, "dividendYield", default=None)
    dividend_yield = fmt_pct_raw(div_yield_raw * 100 if div_yield_raw not in (None, "N/A") else None)
    week52_high = fmt_price(safe(info, "fiftyTwoWeekHigh", default=None))
    week52_low = fmt_price(safe(info, "fiftyTwoWeekLow", default=None))
    avg_volume = fmt_volume(safe(info, "averageVolume", default=None))
    ma50 = fmt_price(safe(info, "fiftyDayAverage", default=None))
    ma200 = fmt_price(safe(info, "twoHundredDayAverage", default=None))
    short_ratio = fmt_num(safe(info, "shortRatio", default=None))

    # 수익성
    gross_margin = fmt_pct(safe(info, "grossMargins", default=None))
    operating_margin = fmt_pct(safe(info, "operatingMargins", default=None))
    profit_margin = fmt_pct(safe(info, "profitMargins", default=None))
    roe = fmt_pct(safe(info, "returnOnEquity", default=None))
    roa = fmt_pct(safe(info, "returnOnAssets", default=None))
    ebitda = fmt_usd(safe(info, "ebitda", default=None))

    # 재무 요약 (yfinance TTM)
    revenue = fmt_usd(safe(info, "totalRevenue", default=None))
    total_cash = fmt_usd(safe(info, "totalCash", default=None))
    total_debt = fmt_usd(safe(info, "totalDebt", default=None))
    debt_to_equity = fmt_num(safe(info, "debtToEquity", default=None))
    current_ratio = fmt_num(safe(info, "currentRatio", default=None))
    quick_ratio = fmt_num(safe(info, "quickRatio", default=None))
    operating_cf = fmt_usd(safe(info, "operatingCashflow", default=None))
    free_cf = fmt_usd(safe(info, "freeCashflow", default=None))
    cash_per_share = fmt_price(safe(info, "totalCashPerShare", default=None))
    enterprise_value = fmt_usd(safe(info, "enterpriseValue", default=None))

    # EPS / 주식
    eps_ttm = fmt_num(safe(info, "trailingEps", default=None))
    eps_forward = fmt_num(safe(info, "forwardEps", default=None))
    shares_outstanding = fmt_volume(safe(info, "sharesOutstanding", default=None))
    insider_pct_raw = safe(info, "heldPercentInsiders", default=None)
    institution_pct_raw = safe(info, "heldPercentInstitutions", default=None)
    insider_pct = fmt_pct(insider_pct_raw)
    institution_pct = fmt_pct(institution_pct_raw)

    # 배당
    earnings_date_raw = safe(info, "earningsTimestamp", default=None)
    try:
        earnings_date = datetime.fromtimestamp(earnings_date_raw).strftime("%Y-%m-%d") if earnings_date_raw and earnings_date_raw != "N/A" else "N/A"
    except Exception:
        earnings_date = "N/A"

    # 애널리스트
    recommendation = safe(info, "recommendationKey", default="N/A")
    rec_map = {
        "strong_buy": ("Strong Buy", "strong-buy"),
        "buy": ("Buy", "buy"),
        "hold": ("Hold", "hold"),
        "sell": ("Sell", "sell"),
        "strong_sell": ("Strong Sell", "sell"),
    }
    rec_label, rec_class = rec_map.get(recommendation, (str(recommendation).title(), "hold"))
    num_analysts = safe(info, "numberOfAnalystOpinions", default="N/A")
    target_high = fmt_price(safe(info, "targetHighPrice", default=None))
    target_mean = fmt_price(safe(info, "targetMeanPrice", default=None))
    target_low = fmt_price(safe(info, "targetLowPrice", default=None))

    upside = "N/A"
    try:
        cp = float(current_price)
        tp = float(safe(info, "targetMeanPrice", default=None))
        upside = f"{(tp - cp) / cp * 100:+.1f}%"
    except Exception:
        pass

    # 회사 정보
    description = info.get("longBusinessSummary", "") or ""
    if len(description) > 800:
        description = description[:800] + "..."
    employees = safe(info, "fullTimeEmployees", default="N/A")
    if employees != "N/A":
        try:
            employees = f"{int(employees):,}"
        except Exception:
            pass
    headquarters = ", ".join(filter(None, [
        info.get("city", ""),
        info.get("state", ""),
        info.get("country", ""),
    ])) or "N/A"
    website = info.get("website", "N/A") or "N/A"
    currency = info.get("currency", "USD") or "USD"
    exchange = info.get("exchange", "N/A") or "N/A"

    # SEC 분기 데이터
    periods, income_rows = build_income_table(facts)

    # 현재 가격 포맷
    current_price_fmt = fmt_price(current_price) if current_price != "N/A" else "N/A"

    return {
        "name": name,
        "ticker": ticker,
        "sector": sector,
        "industry": industry,
        "current_price": current_price_fmt,
        "price_change": price_change,
        "price_dir": price_dir,
        "market_cap": market_cap,
        "exchange": exchange,
        "pe_trailing": pe_trailing,
        "pe_forward": pe_forward,
        "pb_ratio": pb_ratio,
        "ev_ebitda": ev_ebitda,
        "ps_ratio": ps_ratio,
        "beta": beta,
        "dividend_yield": dividend_yield,
        "week52_high": week52_high,
        "week52_low": week52_low,
        "avg_volume": avg_volume,
        "ma50": ma50,
        "ma200": ma200,
        "short_ratio": short_ratio,
        "periods": periods,
        "income_rows": income_rows,
        "gross_margin": gross_margin,
        "operating_margin": operating_margin,
        "profit_margin": profit_margin,
        "roe": roe,
        "roa": roa,
        "ebitda": ebitda,
        "revenue": revenue,
        "total_cash": total_cash,
        "total_debt": total_debt,
        "debt_to_equity": debt_to_equity,
        "current_ratio": current_ratio,
        "quick_ratio": quick_ratio,
        "operating_cf": operating_cf,
        "free_cf": free_cf,
        "cash_per_share": cash_per_share,
        "enterprise_value": enterprise_value,
        "recommendation": rec_label,
        "rec_class": rec_class,
        "num_analysts": num_analysts,
        "target_high": target_high,
        "target_mean": target_mean,
        "target_low": target_low,
        "upside": upside,
        "description": description,
        "employees": employees,
        "headquarters": headquarters,
        "website": website,
        "currency": currency,
        "shares_outstanding": shares_outstanding,
        "insider_pct": insider_pct,
        "institution_pct": institution_pct,
        "eps_ttm": eps_ttm,
        "eps_forward": eps_forward,
        "peg_ratio": peg_ratio,
        "earnings_date": earnings_date,
        "related_stocks": [],  # 2nd pass에서 채움
        "updated_date": datetime.now().strftime("%Y-%m-%d"),
    }


# ──────────────────────────────────────────────
# 인덱스 페이지
# ──────────────────────────────────────────────

def gen_index(companies_meta):
    today = datetime.now().strftime("%B %d, %Y")
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
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
    <title>US Stock Database 2025 | Price, Financials, SEC Data | emfls.com</title>
    <meta name="description" content="Comprehensive US stock database with real-time prices, financial ratios, SEC 10-K/10-Q data for S&P 500 and Nasdaq stocks. Apple, Microsoft, NVIDIA, Amazon, and 150+ more."/>
    <meta name="keywords" content="US stock database,S&P500 stocks,stock financials,SEC filings,stock price,P/E ratio,market cap"/>
    <link rel="canonical" href="{SITE_URL}/report/stock/index.html"/>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-QP5Q67GE5B"></script>
    <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','G-QP5Q67GE5B');</script>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8830524482034754" crossorigin="anonymous"></script>
    <style>
        *{{margin:0;padding:0;box-sizing:border-box;}}
        body{{font-family:'Segoe UI',sans-serif;background:#f0f2f5;color:#1a1a2e;line-height:1.6;}}
        .container{{max-width:1100px;margin:0 auto;padding:20px;}}
        header{{background:linear-gradient(135deg,#0a0a2e,#1a237e,#1565c0);color:white;text-align:center;padding:50px 20px;border-radius:14px;margin-bottom:24px;}}
        header h1{{font-size:2rem;margin-bottom:8px;}}
        header p{{opacity:.85;}}
        .section{{background:white;border-radius:12px;padding:22px 24px;margin-bottom:16px;box-shadow:0 2px 10px rgba(0,0,0,.06);}}
        .section h2{{font-size:1.05rem;color:#1a237e;border-bottom:2px solid #e8eaf6;padding-bottom:8px;margin-bottom:16px;}}
        .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;}}
        .card{{background:#f5f6ff;border-radius:10px;padding:12px 14px;border-left:3px solid #3f51b5;}}
        .card a{{text-decoration:none;color:#1a237e;font-weight:600;font-size:.9rem;}}
        .card a:hover{{color:#3f51b5;}}
        .tkr{{font-size:.8rem;color:#5c6bc0;}}
        .card .meta{{font-size:.75rem;color:#888;margin-top:4px;}}
        .breadcrumb{{font-size:.82rem;color:#888;margin-bottom:14px;}}
        .breadcrumb a{{color:#3f51b5;text-decoration:none;}}
        footer{{text-align:center;padding:20px;color:#999;font-size:.8rem;}}
    </style>
</head>
<body>
<div class="container">
    <div class="breadcrumb"><a href="{SITE_URL}">Home</a> &rsaquo; US Stocks</div>
    <header>
        <h1>📈 US Stock Database</h1>
        <p>Real-time Prices · SEC Financial Data · S&amp;P 500 &amp; Nasdaq | {today}</p>
    </header>
    {sector_html}
    <footer><p>Data sourced from yfinance and SEC EDGAR. For informational purposes only. © 2025 Itagi | <a href="{SITE_URL}" style="color:#3f51b5;">emfls.com</a></p></footer>
</div>
</body>
</html>"""
    output_path.write_text(html, encoding="utf-8")
    print(f"  [index] 미국 주식 인덱스 생성: {len(companies_meta)}개 종목")


# ──────────────────────────────────────────────
# 관련 주식 목록
# ──────────────────────────────────────────────

def build_related(all_companies, current_ticker, current_sector, existing_tickers, n=8):
    same = [c for c in all_companies if c["sector"] == current_sector and c["ticker"] != current_ticker]
    others = [c for c in all_companies if c["sector"] != current_sector and c["ticker"] != current_ticker]
    result = []
    for c in (same + others):
        if c["ticker"] in existing_tickers and len(result) < n:
            result.append({
                "ticker": c["ticker"],
                "name": c["name"],
                "sector": c["sector"],
            })
    return result[:n]


# ──────────────────────────────────────────────
# main
# ──────────────────────────────────────────────

def main():
    if yf is None:
        print("  [오류] yfinance가 설치되지 않았습니다. pip install yfinance")
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
    contexts = {}  # ticker → context (related_stocks 2nd pass용)

    # 1st pass: 페이지 생성
    for company in companies:
        if len(generated) >= DAILY_LIMIT:
            print(f"일일 한도({DAILY_LIMIT}개) 도달.")
            break

        ticker = company["ticker"]
        out_path = OUTPUT_DIR / f"{ticker.lower()}.html"

        # 메타 항상 수집
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
            print(f"  → {ticker} ({company['name']}) 조회 중...")
            info, stock_obj = fetch_yfinance(ticker)
            time.sleep(0.3)

            cik = company.get("cik", "")
            facts = {}
            if cik:
                facts = get_xbrl_facts(cik)
                time.sleep(0.3)

            ctx = build_context(company, info, stock_obj, facts)
            contexts[ticker] = ctx

            html = template.render(**ctx)
            out_path.write_text(html, encoding="utf-8")
            generated.append(f"{SITE_URL}/report/stock/{ticker.lower()}.html")
            print(f"  ✓ {ticker.lower()}.html 생성")

        except Exception as e:
            print(f"  [오류] {ticker}: {e}")

        time.sleep(0.2)

    # 2nd pass: related_stocks 업데이트 (새로 생성한 것만)
    existing_tickers = {c["ticker"] for c in companies_meta}
    for ticker, ctx in contexts.items():
        company = next((c for c in companies if c["ticker"] == ticker), {})
        related = build_related(companies, ticker, company.get("sector", ""), existing_tickers)
        ctx["related_stocks"] = related
        out_path = OUTPUT_DIR / f"{ticker.lower()}.html"
        try:
            html = template.render(**ctx)
            out_path.write_text(html, encoding="utf-8")
        except Exception as e:
            print(f"  [관련주 업데이트 오류] {ticker}: {e}")

    # 인덱스 생성 (메타 있는 경우)
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
