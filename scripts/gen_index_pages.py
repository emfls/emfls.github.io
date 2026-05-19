"""
카테고리 인덱스 페이지 생성기
각 섹션의 목록 페이지를 만들어 내부 링크 구조를 강화합니다.
"""
import json
from pathlib import Path
from datetime import datetime

REPO_ROOT = Path(__file__).parent.parent
SITE_URL = "https://emfls.com"
DATA_PATH = REPO_ROOT / "scripts/data/kr_stocks.json"


COMMON_HEAD = """
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-QP5Q67GE5B"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){{dataLayer.push(arguments);}}
        gtag('js', new Date());
        gtag('config', 'G-QP5Q67GE5B');
    </script>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8830524482034754" crossorigin="anonymous"></script>
"""

COMMON_STYLE = """
    <style>
        * {{ margin:0; padding:0; box-sizing:border-box; }}
        body {{ font-family:'Segoe UI',sans-serif; background:#f8f9fa; color:#333; line-height:1.6; }}
        .container {{ max-width:1100px; margin:0 auto; padding:20px; }}
        header {{ background:linear-gradient(135deg,#1a237e,#1976d2); color:white; text-align:center; padding:50px 20px; border-radius:12px; margin-bottom:30px; }}
        header h1 {{ font-size:2rem; margin-bottom:8px; }}
        header p {{ opacity:.85; }}
        .section {{ background:white; border-radius:10px; padding:25px; margin-bottom:20px; box-shadow:0 2px 8px rgba(0,0,0,.07); }}
        .section h2 {{ font-size:1.2rem; color:#1a237e; border-bottom:2px solid #e3f2fd; padding-bottom:8px; margin-bottom:16px; }}
        .grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; }}
        .card {{ background:#f3f6fc; border-radius:8px; padding:14px 16px; border-left:4px solid #1976d2; transition:transform .15s; }}
        .card:hover {{ transform:translateY(-2px); box-shadow:0 4px 12px rgba(25,118,210,.15); }}
        .card a {{ text-decoration:none; color:#1a237e; font-weight:600; font-size:.95rem; }}
        .card .meta {{ font-size:.78rem; color:#888; margin-top:4px; }}
        .breadcrumb {{ font-size:.82rem; color:#888; margin-bottom:16px; }}
        .breadcrumb a {{ color:#1976d2; text-decoration:none; }}
        footer {{ text-align:center; padding:20px; color:#999; font-size:.8rem; }}
        @media(max-width:600px) {{ header h1 {{ font-size:1.4rem; }} }}
    </style>
"""


def gen_stock_index(stocks: list):
    """주식 분석 인덱스 페이지 생성."""
    output_path = REPO_ROOT / "kor/report/stock/2025/index.html"
    today = datetime.now().strftime("%Y년 %m월 %d일")

    # 섹터별 그룹핑
    sectors: dict[str, list] = {}
    for s in stocks:
        sectors.setdefault(s["sector"], []).append(s)

    # 실제 생성된 파일만 포함
    existing = {f.stem for f in (REPO_ROOT / "kor/report/stock/2025").glob("*.html") if f.name != "index.html"}

    sector_html = ""
    for sector, items in sorted(sectors.items()):
        cards = ""
        for s in items:
            if s["slug"] not in existing:
                continue
            cards += f"""
            <div class="card">
                <a href="{s['slug']}.html">{s['name']} ({s['ticker'].split('.')[0]})</a>
                <div class="meta">{s['market']} · {s['sector']}</div>
            </div>"""
        if cards:
            sector_html += f"""
        <div class="section">
            <h2>📊 {sector}</h2>
            <div class="grid">{cards}
            </div>
        </div>"""

    html = f"""<!doctype html>
<html lang="ko">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
    <title>한국 주식 투자 분석 가이드 2025 | KOSPI·KOSDAQ 종목별 완벽 분석</title>
    <meta name="description" content="삼성전자, SK하이닉스, 현대차 등 KOSPI·KOSDAQ 주요 종목의 주가, 시가총액, PER, 배당수익률을 한눈에 비교하세요. 2025년 최신 주식 투자 분석 가이드."/>
    <meta name="keywords" content="한국주식분석,KOSPI주식,KOSDAQ주식,주식투자가이드,삼성전자주가,SK하이닉스주가"/>
    <link rel="canonical" href="{SITE_URL}/kor/report/stock/2025/index.html"/>
    <meta property="og:title" content="한국 주식 투자 분석 가이드 2025"/>
    <meta property="og:url" content="{SITE_URL}/kor/report/stock/2025/index.html"/>
    <meta property="og:type" content="website"/>
    {COMMON_HEAD}
    {COMMON_STYLE}
</head>
<body>
<div class="container">
    <div class="breadcrumb">
        <a href="{SITE_URL}">홈</a> &rsaquo; 주식 분석
    </div>
    <header>
        <h1>📈 한국 주식 투자 분석 2025</h1>
        <p>KOSPI · KOSDAQ 주요 종목 상세 분석 | {today} 기준</p>
    </header>
    {sector_html}
    <footer>
        <p>본 페이지는 투자 참고용 정보이며 투자 권유가 아닙니다. © 2025 Itagi |
        <a href="{SITE_URL}" style="color:#1976d2;">emfls.com</a></p>
    </footer>
</div>
</body>
</html>"""

    output_path.write_text(html, encoding="utf-8")
    count = len(existing)
    print(f"  [index] 주식 인덱스 페이지 생성: {count}개 종목")
    return str(output_path)


def main():
    with open(DATA_PATH, encoding="utf-8") as f:
        stocks = json.load(f)

    print("[인덱스] 카테고리 인덱스 페이지 생성 중...")
    gen_stock_index(stocks)
    print("인덱스 페이지 생성 완료")


if __name__ == "__main__":
    main()
