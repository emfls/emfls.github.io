"""
한국 주식 페이지 자동 생성기
yfinance로 실시간 데이터 → Jinja2 템플릿 → HTML
"""
import json
import os
from datetime import datetime
from pathlib import Path

import yfinance as yf
from jinja2 import Template

SITE_URL = "https://emfls.com"
REPO_ROOT = Path(__file__).parent.parent
OUTPUT_DIR = REPO_ROOT / "kor/report/stock/2025"
TEMPLATE_PATH = REPO_ROOT / "scripts/templates/kr_stock.html"
DATA_PATH = REPO_ROOT / "scripts/data/kr_stocks.json"
DAILY_LIMIT = 30  # 하루 최대 생성 수


def fmt_krw(value):
    if value is None:
        return "N/A"
    try:
        v = float(value)
        if v >= 1e12:
            return f"{v/1e12:.1f}조원"
        if v >= 1e8:
            return f"{v/1e8:.0f}억원"
        if v >= 1e4:
            return f"{v/1e4:.0f}만원"
        return f"{v:,.0f}원"
    except Exception:
        return "N/A"


def fmt_price(value, currency="KRW"):
    if value is None:
        return "N/A"
    try:
        v = float(value)
        if currency == "KRW":
            return f"{v:,.0f}원"
        return f"${v:,.2f}"
    except Exception:
        return "N/A"


def fmt_volume(value):
    if value is None:
        return "N/A"
    try:
        v = float(value)
        if v >= 1e8:
            return f"{v/1e8:.1f}억주"
        if v >= 1e4:
            return f"{v/1e4:.0f}만주"
        return f"{v:,.0f}주"
    except Exception:
        return "N/A"


def fmt_per(value):
    if value is None:
        return "N/A"
    try:
        v = float(value)
        if v <= 0 or v > 1000:
            return "N/A"
        return f"{v:.1f}배"
    except Exception:
        return "N/A"


def fmt_pbr(value):
    if value is None:
        return "N/A"
    try:
        v = float(value)
        if v <= 0 or v > 100:
            return "N/A"
        return f"{v:.2f}배"
    except Exception:
        return "N/A"


def fmt_dividend(value):
    if value is None:
        return "N/A"
    try:
        v = float(value)
        if v <= 0:
            return "미지급"
        # yfinance는 소수(0.025 = 2.5%)로 반환하나 가끔 이미 % 값으로 반환
        # 15% 초과는 비정상 데이터로 판단
        pct = v * 100 if v < 1 else v
        if pct > 15 or pct <= 0:
            return "확인 필요"
        return f"{pct:.2f}%"
    except Exception:
        return "N/A"


def get_stock_data(ticker_symbol):
    try:
        ticker = yf.Ticker(ticker_symbol)
        info = ticker.info
        return info
    except Exception as e:
        print(f"  [경고] {ticker_symbol} 데이터 조회 실패: {e}")
        return {}


def generate_page(stock, template_str):
    ticker_symbol = stock["ticker"]
    is_krw = ticker_symbol.endswith(".KS") or ticker_symbol.endswith(".KQ")
    currency = "KRW" if is_krw else "USD"

    print(f"  → {stock['name']} ({ticker_symbol}) 데이터 조회 중...")
    info = get_stock_data(ticker_symbol)

    current_price_raw = info.get("currentPrice") or info.get("regularMarketPrice")
    prev_close = info.get("previousClose") or info.get("regularMarketPreviousClose")

    # 가격 변동 방향
    price_dir = "up"
    price_change = "N/A"
    if current_price_raw and prev_close:
        try:
            change = float(current_price_raw) - float(prev_close)
            pct = (change / float(prev_close)) * 100
            sign = "▲" if change >= 0 else "▼"
            price_dir = "up" if change >= 0 else "down"
            if is_krw:
                price_change = f"{sign} {abs(change):,.0f}원 ({pct:+.2f}%)"
            else:
                price_change = f"{sign} ${abs(change):.2f} ({pct:+.2f}%)"
        except Exception:
            pass

    # 시총 처리
    market_cap_raw = info.get("marketCap")
    if is_krw and market_cap_raw:
        market_cap = fmt_krw(market_cap_raw)
    else:
        market_cap = fmt_krw(market_cap_raw) if market_cap_raw else "N/A"

    context = {
        "name": stock["name"],
        "name_en": stock.get("name_en", ""),
        "ticker_code": ticker_symbol.split(".")[0],
        "slug": stock["slug"],
        "sector": stock["sector"],
        "market": stock["market"],
        "keywords": stock["keywords"],
        "keywords_str": ", ".join(stock["keywords"]),
        "current_price": fmt_price(current_price_raw, currency),
        "price_dir": price_dir,
        "price_change": price_change,
        "week52_high": fmt_price(info.get("fiftyTwoWeekHigh"), currency),
        "week52_low": fmt_price(info.get("fiftyTwoWeekLow"), currency),
        "market_cap": market_cap,
        "avg_volume": fmt_volume(info.get("averageVolume")),
        "per": fmt_per(info.get("trailingPE")),
        "pbr": fmt_pbr(info.get("priceToBook")),
        "dividend_yield": fmt_dividend(info.get("dividendYield")),
        "updated_date": datetime.now().strftime("%Y년 %m월 %d일"),
        "related_stocks": stock.get("_related", []),
    }

    tmpl = Template(template_str)
    return tmpl.render(**context)


def build_related(stocks: list, current_slug: str, same_sector: str, n: int = 8) -> list:
    """같은 섹터 우선, 나머지는 랜덤 선택으로 관련 종목 목록 반환."""
    import random
    same = [s for s in stocks if s["sector"] == same_sector and s["slug"] != current_slug]
    others = [s for s in stocks if s["sector"] != same_sector and s["slug"] != current_slug]
    pool = same + others
    chosen = pool[:n] if len(pool) <= n else random.sample(same, min(len(same), 4)) + random.sample(others, min(len(others), n - min(len(same), 4)))
    return [{"slug": s["slug"], "name": s["name"], "ticker_code": s["ticker"].split(".")[0]} for s in chosen[:n]]


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with open(DATA_PATH, encoding="utf-8") as f:
        stocks = json.load(f)

    with open(TEMPLATE_PATH, encoding="utf-8") as f:
        template_str = f.read()

    generated = []
    skipped = 0

    for stock in stocks:
        out_path = OUTPUT_DIR / f"{stock['slug']}.html"
        if out_path.exists():
            skipped += 1
            continue

        if len(generated) >= DAILY_LIMIT:
            print(f"일일 한도({DAILY_LIMIT}개) 도달. 내일 계속 생성됩니다.")
            break

        stock["_related"] = build_related(stocks, stock["slug"], stock["sector"])
        print(f"[생성] {stock['name']} → {out_path.name}")
        try:
            html = generate_page(stock, template_str)
            out_path.write_text(html, encoding="utf-8")
            generated.append(f"{SITE_URL}/kor/report/stock/2025/{stock['slug']}.html")
        except Exception as e:
            print(f"  [오류] {stock['name']}: {e}")

    print(f"\n완료: {len(generated)}개 생성, {skipped}개 이미 존재")

    # 생성된 URL 목록 저장 (IndexNow 제출용)
    if generated:
        new_urls_path = REPO_ROOT / "scripts/new_urls.txt"
        with open(new_urls_path, "a", encoding="utf-8") as f:
            f.write("\n".join(generated) + "\n")
        print(f"새 URL {len(generated)}개 → scripts/new_urls.txt 저장")

    return generated


if __name__ == "__main__":
    main()
