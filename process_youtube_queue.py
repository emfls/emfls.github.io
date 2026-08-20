#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
YouTube 큐 처리 스크립트 — 스케줄 태스크에서 호출됨
동작:
  1. youtube_queue.json에서 pending URL 읽기
  2. URL을 파일로 저장 (Chrome 자동화 신호용)
  3. 처리 완료 후 상태 업데이트
"""

import json, os, sys
from datetime import datetime
from automation_security import require_automation_enabled

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
QUEUE_FILE  = os.path.join(SCRIPT_DIR, "youtube_queue.json")
PENDING_FILE = os.path.join(SCRIPT_DIR, ".pending_url")   # Chrome 자동화용 신호 파일
RESULT_FILE  = os.path.join(SCRIPT_DIR, ".last_result")   # 처리 결과 저장

def load_queue():
    if os.path.exists(QUEUE_FILE):
        return json.load(open(QUEUE_FILE, encoding="utf-8"))
    return []

def save_queue(q):
    json.dump(q, open(QUEUE_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

def get_pending():
    q = load_queue()
    return [item for item in q if item["status"] == "pending"]

def mark_processing(url):
    q = load_queue()
    for item in q:
        if item["url"] == url:
            item["status"] = "processing"
            item["started_at"] = datetime.now().isoformat()
    save_queue(q)

def mark_done(url, page_url):
    q = load_queue()
    for item in q:
        if item["url"] == url:
            item["status"] = "done"
            item["page_url"] = page_url
            item["done_at"] = datetime.now().isoformat()
    save_queue(q)

def mark_failed(url, reason):
    q = load_queue()
    for item in q:
        if item["url"] == url:
            item["status"] = "failed"
            item["error"] = reason
    save_queue(q)

if __name__ == "__main__":
    require_automation_enabled()
    pending = get_pending()
    if not pending:
        print("처리할 항목 없음")
        sys.exit(0)

    # 가장 오래된 pending 하나 선택
    item = pending[0]
    url = item["url"]
    print(f"처리 시작: {url}")

    # 신호 파일 저장 (Claude 스케줄 태스크가 읽어서 브라우저 자동화 실행)
    open(PENDING_FILE, "w").write(url)
    mark_processing(url)
    print(f"신호 파일 저장: {PENDING_FILE}")
    print(f"URL: {url}")
