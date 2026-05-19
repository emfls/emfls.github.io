"""
사이트맵 자동 업데이트
kor/report/stock/2025/ 의 HTML 파일을 스캔해서 sitemap.xml 재생성
"""
from pathlib import Path
from datetime import datetime

REPO_ROOT = Path(__file__).parent.parent
SITE_URL = "https://emfls.com"


def update_subsitemap(folder: Path, url_prefix: str):
    html_files = sorted(folder.glob("*.html"))
    if not html_files:
        return 0

    today = datetime.now().strftime("%Y-%m-%d")
    urls = []
    for f in html_files:
        if f.name in ("sitemap.html", "sitemap_test.html"):
            continue
        urls.append(f"  <url>\n    <loc>{url_prefix}/{f.name}</loc>\n    <lastmod>{today}</lastmod>\n  </url>")

    xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    xml += "\n".join(urls)
    xml += "\n</urlset>"

    sitemap_path = folder / "sitemap.xml"
    sitemap_path.write_text(xml, encoding="utf-8")
    print(f"  [{folder.name}] sitemap.xml 업데이트: {len(urls)}개 URL")
    return len(urls)


def main():
    targets = [
        (REPO_ROOT / "kor/report/stock/2025", f"{SITE_URL}/kor/report/stock/2025"),
        (REPO_ROOT / "kor/report/coin",        f"{SITE_URL}/kor/report/coin"),
        (REPO_ROOT / "kor/report/travel",      f"{SITE_URL}/kor/report/travel"),
        (REPO_ROOT / "kor/report/visa",        f"{SITE_URL}/kor/report/visa"),
        (REPO_ROOT / "kor/report/window",      f"{SITE_URL}/kor/report/window"),
        (REPO_ROOT / "kor/report/camp",        f"{SITE_URL}/kor/report/camp"),
        (REPO_ROOT / "kor/report/animal",      f"{SITE_URL}/kor/report/animal"),
        (REPO_ROOT / "report/travel",          f"{SITE_URL}/report/travel"),
        (REPO_ROOT / "report/sec",             f"{SITE_URL}/report/sec"),
        (REPO_ROOT / "report/stock",           f"{SITE_URL}/report/stock"),
        (REPO_ROOT / "jp/report/travel",       f"{SITE_URL}/jp/report/travel"),
    ]

    total = 0
    for folder, prefix in targets:
        if folder.exists():
            total += update_subsitemap(folder, prefix)

    print(f"\n총 {total}개 URL 사이트맵 업데이트 완료")


if __name__ == "__main__":
    main()
