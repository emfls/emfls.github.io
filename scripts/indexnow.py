"""
IndexNow 자동 URL 제출
새로 생성된 URL을 Bing/Naver에 즉시 색인 요청
"""
import json
import os
import requests
from pathlib import Path

INDEXNOW_KEY = os.environ.get("INDEXNOW_KEY", "")
SITE_URL = "https://emfls.com"
INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
REPO_ROOT = Path(__file__).parent.parent
NEW_URLS_FILE = REPO_ROOT / "scripts/new_urls.txt"
MAX_URLS_PER_REQUEST = 100


def submit_urls(urls: list[str], key: str) -> bool:
    if not urls or not key:
        return False

    payload = {
        "host": "emfls.com",
        "key": key,
        "keyLocation": f"{SITE_URL}/{key}.txt",
        "urlList": urls[:MAX_URLS_PER_REQUEST],
    }

    try:
        resp = requests.post(
            INDEXNOW_ENDPOINT,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        if resp.status_code in (200, 202):
            print(f"  ✅ IndexNow 제출 성공: {len(urls)}개 URL (상태코드: {resp.status_code})")
            return True
        else:
            print(f"  ⚠️ IndexNow 응답: {resp.status_code} — {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"  ❌ IndexNow 제출 실패: {e}")
        return False


def main():
    if not INDEXNOW_KEY:
        print("INDEXNOW_KEY 환경변수가 설정되지 않아 IndexNow 제출을 건너뜁니다.")
        return

    if not NEW_URLS_FILE.exists():
        print("제출할 새 URL이 없습니다.")
        return

    with open(NEW_URLS_FILE, encoding="utf-8") as f:
        urls = [line.strip() for line in f if line.strip().startswith("http")]

    if not urls:
        print("제출할 새 URL이 없습니다.")
        return

    print(f"IndexNow 제출 시작: {len(urls)}개 URL")

    # 100개씩 나눠서 제출
    for i in range(0, len(urls), MAX_URLS_PER_REQUEST):
        batch = urls[i:i + MAX_URLS_PER_REQUEST]
        submit_urls(batch, INDEXNOW_KEY)

    # 제출 완료 후 파일 초기화
    NEW_URLS_FILE.write_text("", encoding="utf-8")
    print("new_urls.txt 초기화 완료")


if __name__ == "__main__":
    main()
