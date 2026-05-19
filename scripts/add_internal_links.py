"""
사이트 전체 내부 링크 강화
- 기존 HTML 페이지의 footer 직전에 크로스 카테고리 링크 섹션 삽입
- 이미 처리된 파일은 건너뜀
"""
import re
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
SITE_URL = "https://emfls.com"

CROSS_LINK_BLOCK = """
    <!-- 사이트 내부 링크 (자동 생성) -->
    <div style="background:white;border-radius:10px;padding:20px 24px;margin-bottom:18px;box-shadow:0 2px 8px rgba(0,0,0,.07);">
        <p style="font-size:.85rem;color:#888;font-weight:600;margin-bottom:10px;">🔗 emfls.com 다른 콘텐츠 보기</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <a href="https://emfls.com/kor/report/stock/2025/index.html" style="display:inline-block;background:#e3f2fd;color:#1565c0;padding:5px 13px;border-radius:20px;font-size:.82rem;text-decoration:none;font-weight:500;">🇰🇷 한국 주식 분석</a>
            <a href="https://emfls.com/kor/report/coin/bitcoin-guide.html" style="display:inline-block;background:#fff3e0;color:#e65100;padding:5px 13px;border-radius:20px;font-size:.82rem;text-decoration:none;font-weight:500;">₿ 암호화폐 가이드</a>
            <a href="https://emfls.com/report/sec/index.html" style="display:inline-block;background:#e8f5e9;color:#2e7d32;padding:5px 13px;border-radius:20px;font-size:.82rem;text-decoration:none;font-weight:500;">📋 SEC 보고서</a>
            <a href="https://emfls.com/kor/report/travel/japan-tokyo.html" style="display:inline-block;background:#fce4ec;color:#c62828;padding:5px 13px;border-radius:20px;font-size:.82rem;text-decoration:none;font-weight:500;">✈️ 여행 가이드</a>
            <a href="https://emfls.com/kor/report/visa/us-visa-guide.html" style="display:inline-block;background:#f3e5f5;color:#6a1b9a;padding:5px 13px;border-radius:20px;font-size:.82rem;text-decoration:none;font-weight:500;">🛂 비자 정보</a>
            <a href="https://emfls.com" style="display:inline-block;background:#f5f5f5;color:#424242;padding:5px 13px;border-radius:20px;font-size:.82rem;text-decoration:none;font-weight:500;">🎮 미니게임</a>
        </div>
    </div>
"""

CROSS_LINK_BLOCK_EN = """
    <!-- site internal links (auto-generated) -->
    <div style="background:white;border-radius:10px;padding:20px 24px;margin-bottom:18px;box-shadow:0 2px 8px rgba(0,0,0,.07);">
        <p style="font-size:.85rem;color:#888;font-weight:600;margin-bottom:10px;">🔗 More on emfls.com</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <a href="https://emfls.com/report/stock/index.html" style="display:inline-block;background:#e8f5e9;color:#1b5e20;padding:5px 13px;border-radius:20px;font-size:.82rem;text-decoration:none;font-weight:500;">📈 US Stocks</a>
            <a href="https://emfls.com/report/sec/index.html" style="display:inline-block;background:#e3f2fd;color:#0d47a1;padding:5px 13px;border-radius:20px;font-size:.82rem;text-decoration:none;font-weight:500;">📋 SEC Filings</a>
            <a href="https://emfls.com/kor/report/stock/2025/index.html" style="display:inline-block;background:#fff8e1;color:#e65100;padding:5px 13px;border-radius:20px;font-size:.82rem;text-decoration:none;font-weight:500;">🇰🇷 Korean Stocks</a>
            <a href="https://emfls.com/report/travel/" style="display:inline-block;background:#fce4ec;color:#c62828;padding:5px 13px;border-radius:20px;font-size:.82rem;text-decoration:none;font-weight:500;">✈️ Travel Guides</a>
            <a href="https://emfls.com" style="display:inline-block;background:#f5f5f5;color:#424242;padding:5px 13px;border-radius:20px;font-size:.82rem;text-decoration:none;font-weight:500;">🎮 Mini Games</a>
        </div>
    </div>
"""

MARKER = "emfls-internal-links-added"


def already_processed(content: str) -> bool:
    return MARKER in content


def inject_links(content: str, block: str) -> str:
    """</body> 직전에 링크 블록 삽입."""
    marker_comment = f"<!-- {MARKER} -->"
    insert = f"{marker_comment}\n{block}"
    return content.replace("</body>", f"{insert}\n</body>", 1)


def process_directory(folder: Path, block: str, pattern: str = "*.html") -> tuple[int, int]:
    updated = 0
    skipped = 0
    for html_file in folder.glob(pattern):
        if html_file.name in ("index.html", "sitemap.html"):
            continue
        try:
            content = html_file.read_text(encoding="utf-8")
            if already_processed(content):
                skipped += 1
                continue
            if "</body>" not in content:
                skipped += 1
                continue
            new_content = inject_links(content, block)
            html_file.write_text(new_content, encoding="utf-8")
            updated += 1
        except Exception as e:
            print(f"  [오류] {html_file.name}: {e}")
    return updated, skipped


def main():
    targets = [
        # (폴더, 링크블록, 파일 패턴)
        (REPO_ROOT / "kor/report/stock/2025", CROSS_LINK_BLOCK, "*.html"),
        (REPO_ROOT / "kor/report/coin", CROSS_LINK_BLOCK, "*.html"),
        (REPO_ROOT / "kor/report/travel", CROSS_LINK_BLOCK, "*.html"),
        (REPO_ROOT / "kor/report/visa", CROSS_LINK_BLOCK, "*.html"),
        (REPO_ROOT / "kor/report/window", CROSS_LINK_BLOCK, "*.html"),
        (REPO_ROOT / "kor/report/camp", CROSS_LINK_BLOCK, "*.html"),
        (REPO_ROOT / "kor/report/animal", CROSS_LINK_BLOCK, "*.html"),
        (REPO_ROOT / "report/travel", CROSS_LINK_BLOCK_EN, "*.html"),
        (REPO_ROOT / "report/sec", CROSS_LINK_BLOCK_EN, "*.html"),
        (REPO_ROOT / "report/stock", CROSS_LINK_BLOCK_EN, "*.html"),
        (REPO_ROOT / "jp/report/travel", CROSS_LINK_BLOCK_EN, "*.html"),
    ]

    total_updated = 0
    total_skipped = 0
    for folder, block, pattern in targets:
        if not folder.exists():
            continue
        u, s = process_directory(folder, block, pattern)
        total_updated += u
        total_skipped += s
        if u > 0:
            print(f"  [{folder.name}] {u}개 업데이트, {s}개 이미 처리됨")

    print(f"\n내부 링크 삽입 완료: 총 {total_updated}개 업데이트, {total_skipped}개 스킵")


if __name__ == "__main__":
    main()
