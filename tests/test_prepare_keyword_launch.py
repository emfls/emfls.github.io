import json
from scripts.prepare_keyword_launch import prepare_queue

def test_prepare_queue_records_required_fields_and_preserves_excluded(tmp_path):
    rows=[{"keyword":"무료 계산기","status":"NEW","score_valid":"True","opportunity_score":"90","confidence":"HIGH","category":"tools","action":"NEW_PAGE","content_types":"calculator/tool|evergreen","suggested_url":"/kor/util/free/index.html","closest_url":"","overlap":"NO_OVERLAP"}]
    out=prepare_queue(rows, existing_urls=set(), published_keywords=set(), daily_limit=1, selected_at="2026-09-12T00:00:00+09:00")
    item=out["queue"][0]
    for key in ("keyword","source","status","opportunity_score","confidence","category","intended_page_type","suggested_url","duplicate_check","reason","selected_at"): assert key in item
    assert item["status"] == "READY_TO_LAUNCH"
