"""
전체 자동화 파이프라인 실행
1. 한국 주식 페이지 생성
2. 사이트맵 업데이트
3. IndexNow 제출
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import gen_kr_stocks
import gen_sec_filings
import gen_us_stocks
import gen_kor_us_stocks
import gen_crypto
import gen_index_pages
import add_internal_links
import update_sitemap
import indexnow


def main():
    print("=" * 50)
    print("🚀 자동화 파이프라인 시작")
    print("=" * 50)

    print("\n[1/9] 한국 주식 페이지 생성")
    gen_kr_stocks.main()

    print("\n[2/9] SEC 보고서 페이지 생성")
    gen_sec_filings.main()

    print("\n[3/9] 미국 주식 (영문) 페이지 생성")
    gen_us_stocks.main()

    print("\n[4/9] 미국 주식 (한국어) 페이지 생성")
    gen_kor_us_stocks.main()

    print("\n[5/9] 암호화폐 페이지 생성")
    gen_crypto.main()

    print("\n[6/9] 카테고리 인덱스 페이지 생성")
    gen_index_pages.main()

    print("\n[7/9] 내부 링크 강화")
    add_internal_links.main()

    print("\n[8/9] 사이트맵 업데이트")
    update_sitemap.main()

    print("\n[9/9] IndexNow 제출")
    indexnow.main()

    print("\n" + "=" * 50)
    print("✅ 파이프라인 완료")
    print("=" * 50)


if __name__ == "__main__":
    main()
