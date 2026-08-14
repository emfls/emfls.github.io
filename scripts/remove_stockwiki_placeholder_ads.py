#!/usr/bin/env python3
"""Remove nonfunctional placeholder advertising from generated StockWiki HTML."""

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
PAGES = [ROOT / "kor/stockwiki/index.html", *sorted((ROOT / "kor/stockwiki/stocks").glob("*/index.html"))]
FORBIDDEN = ("ca-pub-XXXXXXXXXXXXXXXX", "adsbygoogle", "ad-slot", "mobile-ad-fixed")


def clean_html(html: str) -> str:
    cleaned = html
    cleaned = re.sub(
        r'<aside class="sidebar"[^>]*><div class="sidebar-sticky"[^>]*>'
        r'<div class="ad-slot[^"]*"[^>]*><ins class="adsbygoogle".*?</ins>'
        r'<script>\(adsbygoogle = window\.adsbygoogle \|\| \[\]\)\.push\(\{\}\);</script>'
        r'</div></div></aside>',
        "",
        cleaned,
        flags=re.S,
    )
    cleaned = re.sub(
        r'<div class="ad-slot[^"]*"[^>]*><ins class="adsbygoogle".*?</ins>'
        r'<script>\(adsbygoogle = window\.adsbygoogle \|\| \[\]\)\.push\(\{\}\);</script></div>',
        "",
        cleaned,
        flags=re.S,
    )
    cleaned = re.sub(
        r'<div class="mobile-ad-fixed"[^>]*>.*?<ins class="adsbygoogle".*?</ins>\s*</div>',
        "",
        cleaned,
        flags=re.S,
    )
    cleaned = re.sub(r'\.mobile-ad-fixed\[data-astro-cid-[^\]]+\]\{[^{}]+\}', "", cleaned)
    cleaned = re.sub(r'main\[data-astro-cid-[^\]]+\]\{padding-bottom:80px\}', "", cleaned)
    cleaned = re.sub(
        r'\.ad-slot\[data-astro-cid-[^\]]+\]\{[^{}]+\}'
        r'\.ad-slot\[data-astro-cid-[^\]]+\] ins\[data-astro-cid-[^\]]+\],'
        r'\.ad-slot\[data-astro-cid-[^\]]+\] iframe\[data-astro-cid-[^\]]+\]\{[^{}]+\}',
        "",
        cleaned,
    )
    cleaned = re.sub(r'\.banner-ad\[data-astro-cid-[^\]]+\]\{[^{}]+\}', "", cleaned)
    cleaned = re.sub(r'<!--\s*(?:광고|사이드바 광고|모바일 하단 고정 광고)[^>]*-->', "", cleaned)
    cleaned = re.sub(r"[ \t]+(?=\n|$)", "", cleaned)
    leftovers = [marker for marker in FORBIDDEN if marker in cleaned]
    if leftovers:
        raise ValueError(f"unremoved StockWiki ad markers: {', '.join(leftovers)}")
    return cleaned


def main() -> None:
    if len(PAGES) != 11:
        raise SystemExit(f"expected 11 StockWiki pages, found {len(PAGES)}")
    changed = 0
    for page in PAGES:
        original = page.read_text(encoding="utf-8")
        updated = clean_html(original)
        if updated != original:
            page.write_text(updated, encoding="utf-8")
            changed += 1
    print(f"changed={changed} pages={len(PAGES)}")


if __name__ == "__main__":
    main()
