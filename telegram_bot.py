#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
텔레그램 봇 — YouTube URL 수신 시 queue.json에 저장
백그라운드에서 실행: python3 telegram_bot.py
"""

import requests, json, os, re, time
from datetime import datetime

BOT_TOKEN = "8595780602:AAF1mlorCVtSVcwisQQUBD66RWRQFrgVC4Q"
CHAT_ID   = "124378681"
BASE      = f"https://api.telegram.org/bot{BOT_TOKEN}"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
QUEUE_FILE = os.path.join(SCRIPT_DIR, "youtube_queue.json")
OFFSET_FILE = os.path.join(SCRIPT_DIR, ".tg_offset")

YOUTUBE_RE = re.compile(
    r'(https?://(?:www\.)?(?:youtube\.com/watch\?[^\s]*v=|youtu\.be/)[\w\-]+[^\s]*)'
)

def send(text):
    requests.post(f"{BASE}/sendMessage",
                  json={"chat_id": CHAT_ID, "text": text, "parse_mode": "HTML"},
                  timeout=8)

def load_queue():
    if os.path.exists(QUEUE_FILE):
        return json.load(open(QUEUE_FILE))
    return []

def save_queue(q):
    json.dump(q, open(QUEUE_FILE, "w"), ensure_ascii=False, indent=2)

def get_offset():
    if os.path.exists(OFFSET_FILE):
        return int(open(OFFSET_FILE).read().strip())
    return 0

def save_offset(n):
    open(OFFSET_FILE, "w").write(str(n))

def poll():
    offset = get_offset()
    try:
        r = requests.get(f"{BASE}/getUpdates",
                         params={"offset": offset, "timeout": 30},
                         timeout=35)
        updates = r.json().get("result", [])
    except Exception as e:
        print(f"[{datetime.now():%H:%M:%S}] 폴링 오류: {e}")
        return

    for u in updates:
        offset = u["update_id"] + 1
        msg = u.get("message", {})
        text = msg.get("text", "") or ""

        urls = YOUTUBE_RE.findall(text)
        if urls:
            queue = load_queue()
            added = []
            for url in urls:
                # 중복 체크
                if not any(item["url"] == url for item in queue):
                    entry = {
                        "url": url,
                        "received_at": datetime.now().isoformat(),
                        "status": "pending"
                    }
                    queue.append(entry)
                    added.append(url)

            if added:
                save_queue(queue)
                send(f"✅ YouTube URL {len(added)}개 접수됐습니다.\n처리 중... 완료되면 알려드릴게요! 🔄")
                print(f"[{datetime.now():%H:%M:%S}] 큐 추가: {added}")
            else:
                send("⚠️ 이미 처리 중인 URL입니다.")

    save_offset(offset)

def main():
    print(f"[{datetime.now():%H:%M:%S}] 텔레그램 봇 시작 (폴링 간격: 5초)")
    send("🤖 봇이 시작됐습니다. YouTube URL을 보내주세요!")
    while True:
        try:
            poll()
        except KeyboardInterrupt:
            print("\n봇 종료")
            break
        except Exception as e:
            print(f"오류: {e}")
        time.sleep(5)

if __name__ == "__main__":
    main()
