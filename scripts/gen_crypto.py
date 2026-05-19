"""
암호화폐 페이지 생성기
CoinGecko 무료 API → /report/crypto/{id}.html
"""
import json
import time
import requests
from datetime import datetime
from pathlib import Path
from jinja2 import Template

SITE_URL = "https://emfls.com"
REPO_ROOT = Path(__file__).parent.parent
OUTPUT_DIR = REPO_ROOT / "report/crypto"
TEMPLATE_PATH = REPO_ROOT / "scripts/templates/crypto.html"
DATA_PATH = REPO_ROOT / "scripts/data/cryptos.json"
DAILY_LIMIT = 30

COINGECKO_BASE = "https://api.coingecko.com/api/v3"
HEADERS = {"Accept": "application/json", "User-Agent": "emfls.com qordltkr124@gmail.com"}


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
        if abs(v) >= 1e3:
            return f"${v/1e3:.2f}K"
        if abs(v) < 0.01:
            return f"${v:.8f}"
        if abs(v) < 1:
            return f"${v:.4f}"
        return f"${v:,.2f}"
    except Exception:
        return "N/A"


def fmt_pct(value):
    if value is None:
        return "N/A"
    try:
        v = float(value)
        sign = "+" if v >= 0 else ""
        return f"{sign}{v:.2f}%"
    except Exception:
        return "N/A"


def fmt_supply(value, symbol):
    if value is None:
        return "∞"
    try:
        v = float(value)
        if v >= 1e12:
            return f"{v/1e12:.2f}T {symbol}"
        if v >= 1e9:
            return f"{v/1e9:.2f}B {symbol}"
        if v >= 1e6:
            return f"{v/1e6:.2f}M {symbol}"
        return f"{v:,.0f} {symbol}"
    except Exception:
        return "N/A"


def get_coin_data(coin_id):
    url = f"{COINGECKO_BASE}/coins/{coin_id}"
    params = {
        "localization": "false",
        "tickers": "false",
        "market_data": "true",
        "community_data": "false",
        "developer_data": "false",
    }
    for attempt in range(3):
        r = requests.get(url, headers=HEADERS, params=params, timeout=20)
        if r.status_code == 429:
            wait = 30 * (attempt + 1)
            print(f"    rate limit, {wait}초 대기 후 재시도...")
            time.sleep(wait)
            continue
        r.raise_for_status()
        return r.json()
    r.raise_for_status()
    return r.json()


def dir_class(pct):
    try:
        return "up" if float(pct or 0) >= 0 else "down"
    except Exception:
        return "up"


def build_context(coin_info, crypto_meta):
    md = coin_info.get("market_data", {})
    symbol = coin_info.get("symbol", "").upper()
    name = coin_info.get("name", "")
    coin_id = coin_info.get("id", "")

    current_price = fmt_usd(md.get("current_price", {}).get("usd"))
    market_cap = fmt_usd(md.get("market_cap", {}).get("usd"))
    market_cap_rank = md.get("market_cap_rank") or coin_info.get("market_cap_rank", "N/A")
    volume_24h = fmt_usd(md.get("total_volume", {}).get("usd"))
    high_24h = fmt_usd(md.get("high_24h", {}).get("usd"))
    low_24h = fmt_usd(md.get("low_24h", {}).get("usd"))

    circ = md.get("circulating_supply")
    total = md.get("total_supply")
    max_s = md.get("max_supply")
    circulating_supply = fmt_supply(circ, symbol)
    total_supply = fmt_supply(total, symbol)
    max_supply = fmt_supply(max_s, symbol) if max_s else "∞"

    change_1h = fmt_pct(md.get("price_change_percentage_1h_in_currency", {}).get("usd"))
    change_24h = fmt_pct(md.get("price_change_percentage_24h"))
    change_7d = fmt_pct(md.get("price_change_percentage_7d"))
    change_14d = fmt_pct(md.get("price_change_percentage_14d"))
    change_30d = fmt_pct(md.get("price_change_percentage_30d"))
    change_1y = fmt_pct(md.get("price_change_percentage_1y"))

    ath = fmt_usd(md.get("ath", {}).get("usd"))
    ath_pct = md.get("ath_change_percentage", {}).get("usd")
    ath_change = fmt_pct(ath_pct)
    ath_date_raw = md.get("ath_date", {}).get("usd", "")
    ath_date = ath_date_raw[:10] if ath_date_raw else "N/A"

    atl = fmt_usd(md.get("atl", {}).get("usd"))
    atl_pct = md.get("atl_change_percentage", {}).get("usd")
    atl_change = fmt_pct(atl_pct)
    atl_date_raw = md.get("atl_date", {}).get("usd", "")
    atl_date = atl_date_raw[:10] if atl_date_raw else "N/A"

    fdv = fmt_usd(md.get("fully_diluted_valuation", {}).get("usd"))

    vol_mc = "N/A"
    try:
        v = md.get("total_volume", {}).get("usd", 0)
        mc = md.get("market_cap", {}).get("usd", 0)
        if mc and mc > 0:
            vol_mc = f"{v/mc*100:.2f}%"
    except Exception:
        pass

    circ_total = "N/A"
    try:
        if circ and total and total > 0:
            circ_total = f"{circ/total*100:.1f}%"
    except Exception:
        pass

    desc_raw = coin_info.get("description", {}).get("en", "") or ""
    # HTML 태그 제거
    import re
    desc = re.sub(r"<[^>]+>", "", desc_raw)[:800]
    if len(re.sub(r"<[^>]+>", "", desc_raw)) > 800:
        desc += "..."

    categories = ", ".join((coin_info.get("categories") or [])[:3])
    genesis_date = coin_info.get("genesis_date") or "N/A"
    hashing_algo = coin_info.get("hashing_algorithm") or "N/A"

    return {
        "id": coin_id,
        "symbol": symbol,
        "name": name,
        "current_price": current_price,
        "market_cap": market_cap,
        "market_cap_rank": market_cap_rank,
        "volume_24h": volume_24h,
        "high_24h": high_24h,
        "low_24h": low_24h,
        "circulating_supply": circulating_supply,
        "total_supply": total_supply,
        "max_supply": max_supply,
        "change_1h": change_1h,
        "change_24h": change_24h,
        "change_7d": change_7d,
        "change_14d": change_14d,
        "change_30d": change_30d,
        "change_1y": change_1y,
        "dir_24h": dir_class(md.get("price_change_percentage_24h")),
        "dir_7d": dir_class(md.get("price_change_percentage_7d")),
        "ath": ath,
        "ath_change": ath_change,
        "ath_date": ath_date,
        "atl": atl,
        "atl_change": atl_change,
        "atl_date": atl_date,
        "fully_diluted_val": fdv,
        "vol_market_cap": vol_mc,
        "circ_total_ratio": circ_total,
        "genesis_date": genesis_date,
        "hashing_algo": hashing_algo,
        "description": desc,
        "categories": categories,
        "related_cryptos": [],
        "updated_date": datetime.now().strftime("%Y-%m-%d"),
    }


def gen_index(cryptos_meta):
    today = datetime.now().strftime("%B %d, %Y")
    output_path = OUTPUT_DIR / "index.html"

    cards = "".join(
        f'<div class="card"><a href="{m["id"]}.html">'
        f'{m["name"]} <span class="sym">({m["symbol"]})</span></a></div>'
        for m in cryptos_meta
    )

    html = f"""<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
    <title>Cryptocurrency Prices & Analysis 2025 | Bitcoin, Ethereum & Top 100 Coins</title>
    <meta name="description" content="Live prices and analysis for Bitcoin, Ethereum, Solana, and 100+ cryptocurrencies. Market cap, 24h change, all-time high, and complete market data."/>
    <meta name="keywords" content="cryptocurrency prices,bitcoin price,ethereum price,crypto market cap,top cryptocurrencies,altcoin analysis"/>
    <link rel="canonical" href="{SITE_URL}/report/crypto/index.html"/>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-QP5Q67GE5B"></script>
    <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','G-QP5Q67GE5B');</script>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8830524482034754" crossorigin="anonymous"></script>
    <style>
        *{{margin:0;padding:0;box-sizing:border-box;}}
        body{{font-family:'Segoe UI',sans-serif;background:#0f0f1a;color:#e0e0e0;line-height:1.6;}}
        .container{{max-width:1100px;margin:0 auto;padding:20px;}}
        header{{background:linear-gradient(135deg,#0f0f1a,#1a1a3e,#12213e);border:1px solid rgba(100,150,255,.15);color:white;text-align:center;padding:48px 20px;border-radius:14px;margin-bottom:22px;}}
        header h1{{font-size:2rem;margin-bottom:8px;}}
        header p{{opacity:.75;font-size:.9rem;}}
        .section{{background:#1a1a2e;border:1px solid rgba(100,150,255,.1);border-radius:12px;padding:20px 22px;margin-bottom:14px;}}
        .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:9px;}}
        .card{{background:#12122a;border-radius:10px;padding:11px 13px;border-left:3px solid #3f51b5;}}
        .card a{{text-decoration:none;color:#90caf9;font-weight:600;font-size:.88rem;}}
        .card a:hover{{color:#e8eaf6;}}
        .sym{{font-size:.77rem;color:#5c6bc0;}}
        .breadcrumb{{font-size:.8rem;color:#555;margin-bottom:12px;}}
        .breadcrumb a{{color:#7986cb;text-decoration:none;}}
        footer{{text-align:center;padding:20px;color:#555;font-size:.78rem;}}
        footer a{{color:#7986cb;}}
    </style>
</head>
<body>
<div class="container">
    <div class="breadcrumb"><a href="{SITE_URL}">Home</a> &rsaquo; Cryptocurrency</div>
    <header>
        <h1>₿ Cryptocurrency Database</h1>
        <p>Live Prices · Market Cap · Historical Data · Top 100 Coins | {today}</p>
    </header>
    <div class="section">
        <div class="grid">{cards}</div>
    </div>
    <footer><p>Data from CoinGecko. Informational only. © 2025 Itagi | <a href="{SITE_URL}">emfls.com</a></p></footer>
</div>
</body>
</html>"""
    output_path.write_text(html, encoding="utf-8")
    print(f"  [index] 암호화폐 인덱스 생성: {len(cryptos_meta)}개")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with open(DATA_PATH, encoding="utf-8") as f:
        cryptos = json.load(f)
    with open(TEMPLATE_PATH, encoding="utf-8") as f:
        template_str = f.read()

    template = Template(template_str)
    generated = []
    skipped = 0
    cryptos_meta = []

    for crypto in cryptos:
        if len(generated) >= DAILY_LIMIT:
            print(f"일일 한도({DAILY_LIMIT}개) 도달.")
            break

        coin_id = crypto["id"]
        out_path = OUTPUT_DIR / f"{coin_id}.html"

        cryptos_meta.append({
            "id": coin_id,
            "symbol": crypto["symbol"].upper(),
            "name": crypto["name"],
        })

        if out_path.exists():
            skipped += 1
            continue

        try:
            print(f"  → {crypto['symbol'].upper()} ({crypto['name']}) 조회 중...")
            data = get_coin_data(coin_id)
            time.sleep(6)  # CoinGecko 무료 tier: ~10 req/min → 6초 간격

            ctx = build_context(data, crypto)
            # 관련 코인: 앞뒤 6개
            idx = next((i for i, c in enumerate(cryptos) if c["id"] == coin_id), 0)
            related = [
                {"id": c["id"], "symbol": c["symbol"].upper(), "name": c["name"]}
                for c in cryptos[max(0, idx-3):idx] + cryptos[idx+1:idx+4]
                if c["id"] != coin_id
            ][:6]
            ctx["related_cryptos"] = related

            html = template.render(**ctx)
            out_path.write_text(html, encoding="utf-8")
            generated.append(f"{SITE_URL}/report/crypto/{coin_id}.html")
            print(f"  ✓ {coin_id}.html 생성")

        except Exception as e:
            print(f"  [오류] {coin_id}: {e}")

        time.sleep(1)

    if cryptos_meta:
        gen_index(cryptos_meta)

    print(f"\n완료: {len(generated)}개 생성, {skipped}개 이미 존재")

    if generated:
        new_urls_path = REPO_ROOT / "scripts/new_urls.txt"
        with open(new_urls_path, "a", encoding="utf-8") as f:
            f.write("\n".join(generated) + "\n")
        print(f"새 URL {len(generated)}개 → scripts/new_urls.txt 저장")

    return generated


if __name__ == "__main__":
    main()
