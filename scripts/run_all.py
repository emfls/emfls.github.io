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
import gen_index_pages
import update_sitemap
import indexnow


def main():
    print("=" * 50)
    print("🚀 자동화 파이프라인 시작")
    print("=" * 50)

    print("\n[1/4] 한국 주식 페이지 생성")
    gen_kr_stocks.main()

    print("\n[2/4] 카테고리 인덱스 페이지 생성")
    gen_index_pages.main()

    print("\n[3/4] 사이트맵 업데이트")
    update_sitemap.main()

    print("\n[4/4] IndexNow 제출")
    indexnow.main()

    print("\n" + "=" * 50)
    print("✅ 파이프라인 완료")
    print("=" * 50)


if __name__ == "__main__":
    main()
