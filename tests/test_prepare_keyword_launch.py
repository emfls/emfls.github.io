import json
import csv
from scripts import prepare_keyword_launch
from scripts.prepare_keyword_launch import prepare_queue

def test_prepare_queue_records_required_fields_and_preserves_excluded(tmp_path):
    rows=[{"keyword":"무료 계산기","status":"NEW","score_valid":"True","opportunity_score":"90","confidence":"HIGH","category":"tools","action":"NEW_PAGE","content_types":"calculator/tool|evergreen","suggested_url":"/kor/util/free/index.html","closest_url":"","overlap":"NO_OVERLAP"}]
    out=prepare_queue(rows, existing_urls=set(), published_keywords=set(), daily_limit=1, selected_at="2026-09-12T00:00:00+09:00")
    item=out["queue"][0]
    for key in ("keyword","source","status","opportunity_score","confidence","category","intended_page_type","suggested_url","duplicate_check","reason","selected_at"): assert key in item
    assert item["status"] == "READY_TO_LAUNCH"
    assert item["review_status"] == "PAGE_REVIEW_READY"

def test_kst_midnight_rollover_is_next_publication_day():
    rows=[{"keyword":"새 도구","status":"NEW","score_valid":"True","opportunity_score":"90","action":"NEW_PAGE","content_types":"calculator/tool","suggested_url":"/kor/util/new/"}]
    assert prepare_queue(rows,set(),set(),1,"2026-09-14T00:30:00+09:00",1,"2026-09-13")["queue"]

def test_prepare_does_not_increment_launch_count():
    rows=[{"keyword":"무료 계산기","status":"NEW","score_valid":"True","opportunity_score":"90","confidence":"HIGH","category":"tools","action":"NEW_PAGE","content_types":"calculator/tool","suggested_url":"/kor/util/free/index.html"}]
    out=prepare_queue(rows,set(),set(),1,"2026-09-12T00:00:00+09:00",0)
    assert out["dailyLimit"] == 1

def test_counter_applies_only_on_same_local_date():
    rows=[{"keyword":"무료 계산기","status":"NEW","score_valid":"True","opportunity_score":"90","confidence":"HIGH","category":"tools","action":"NEW_PAGE","content_types":"calculator/tool","suggested_url":"/kor/util/free/index.html"}]
    assert prepare_queue(rows,set(),set(),1,"2026-09-12T20:00:00+09:00",1,"2026-09-12")["queue"] == []
    assert len(prepare_queue(rows,set(),set(),1,"2026-09-13T20:00:00+09:00",1,"2026-09-12")["queue"]) == 1

def test_prepare_is_deterministic_and_does_not_mutate_counter():
    rows=[{"keyword":"무료 계산기","status":"NEW","score_valid":"True","opportunity_score":"90","confidence":"HIGH","category":"tools","action":"NEW_PAGE","content_types":"calculator/tool","suggested_url":"/kor/util/free/index.html"}]
    counter={"date":"2026-09-12","launchedCount":0,"dailyLimit":1}
    a=prepare_queue(rows,set(),set(),1,"2026-09-12T20:00:00+09:00",0,counter["date"]); b=prepare_queue(rows,set(),set(),1,"2026-09-12T20:00:00+09:00",0,counter["date"])
    assert a == b and counter == {"date":"2026-09-12","launchedCount":0,"dailyLimit":1}

def test_editorial_hold_skips_candidate_and_selects_next():
    rows=[{"keyword":"정수기추천","status":"NEW","score_valid":"True","opportunity_score":"90","confidence":"HIGH","category":"recovery","action":"NEW_PAGE","content_types":"informational"}, {"keyword":"안전한도구","status":"NEW","score_valid":"True","opportunity_score":"80","confidence":"HIGH","category":"tools","action":"NEW_PAGE","content_types":"calculator/tool"}]
    out=prepare_queue(rows,set(),set(),1,"2026-09-13T00:00:00+00:00",0,None, [{"keyword":"정수기 추천","decision":"HOLD"}])
    assert out["queue"][0]["keyword"] == "안전한도구" and out["excluded"]["editorial_hold"] == 1

def test_editorial_hold_does_not_mutate_rows():
    row={"keyword":"정수기추천","status":"NEW","score_valid":"True","opportunity_score":"90","action":"NEW_PAGE"}; original=dict(row)
    out=prepare_queue([row],set(),set(),1,"2026-09-13T00:00:00+00:00",0,None,[{"keyword":"정수기추천","decision":"HOLD"}])
    assert row == original and out["excluded"]["editorial_hold"] == 1

def test_unknown_editorial_decision_is_ignored_safely():
    row={"keyword":"안전한도구","status":"NEW","score_valid":"True","opportunity_score":"80","action":"NEW_PAGE","content_types":"calculator/tool"}
    out=prepare_queue([row],set(),set(),1,"2026-09-13T00:00:00+00:00",0,None,[{"keyword":"안전한도구","decision":"UNKNOWN"}])
    assert out["queue"] and out["excluded"]["editorial_hold"] == 0

def test_car_check_cost_hold_does_not_block_distinct_inspection_keyword():
    rows=[{"keyword":"자동차점검비용","status":"NEW","score_valid":"True","opportunity_score":"90","action":"NEW_PAGE","content_types":"informational"}, {"keyword":"자동차검사비용","status":"NEW","score_valid":"True","opportunity_score":"80","action":"NEW_PAGE","content_types":"informational"}]
    out=prepare_queue(rows,set(),set(),1,"2026-09-13T00:00:00+00:00",0,None,[{"keyword":"자동차점검비용","decision":"HOLD"}])
    assert out["excluded"]["editorial_hold"] == 1 and out["queue"][0]["keyword"] == "자동차검사비용"

def launch_row(keyword, url, score="80"):
    return {"keyword":keyword,"status":"NEW","score_valid":"True","opportunity_score":score,"confidence":"HIGH","category":"column","action":"NEW_PAGE","content_types":"informational","overlap":"NO_OVERLAP","suggested_url":url}

def published_manifest(**overrides):
    manifest={"status":"PUBLISHED","runAt":"2026-09-28T09:52:01+09:00","candidateIds":["keyword:1688구매대행"],"urls":["/kor/column/1688gumaedaehaeng/"],"publishedToday":1,"dailyLimit":1}
    manifest.update(overrides)
    return manifest

def test_published_manifest_keyword_id_dedupes_when_registry_is_missing_it():
    result=prepare_queue([launch_row("1688구매대행","/kor/column/1688gumaedaehaeng/")],set(),set(),1,"2026-09-29T12:00:00+09:00",0,"2026-09-28",published_manifest=published_manifest())
    assert result["queue"] == []
    assert result["excluded"]["duplicate_keyword"] == 1

def test_published_manifest_url_dedupes_index_alias():
    manifest=published_manifest(candidateIds=[],urls=["/kor/column/1688gumaedaehaeng/"])
    result=prepare_queue([launch_row("다른 구매 주제","/kor/column/1688gumaedaehaeng/index.html")],set(),set(),1,"2026-09-29T12:00:00+09:00",0,"2026-09-28",published_manifest=manifest)
    assert result["queue"] == []
    assert result["excluded"]["duplicate_url"] == 1

def test_non_published_manifest_does_not_dedupe_or_consume_slot():
    manifest=published_manifest(status="READY")
    result=prepare_queue([launch_row("1688구매대행","/kor/column/1688gumaedaehaeng/")],set(),set(),1,"2026-09-28T12:00:00+09:00",0,"2026-09-13",published_manifest=manifest)
    assert [item["keyword"] for item in result["queue"]] == ["1688구매대행"]

def test_unknown_manifest_candidate_namespace_is_not_a_keyword():
    manifest=published_manifest(runAt="2026-09-27T09:52:01+09:00",candidateIds=["external:1688구매대행"],urls=["/kor/column/some-other-page/"])
    result=prepare_queue([launch_row("1688구매대행","/kor/column/1688gumaedaehaeng/")],set(),set(),1,"2026-09-28T12:00:00+09:00",0,"2026-09-27",published_manifest=manifest)
    assert [item["keyword"] for item in result["queue"]] == ["1688구매대행"]

def test_launched_manifest_is_a_final_publication_dedupe_source():
    manifest=published_manifest(status="LAUNCHED",runAt="2026-09-27T09:52:01+09:00")
    result=prepare_queue([launch_row("1688구매대행","/kor/column/1688gumaedaehaeng/")],set(),set(),1,"2026-09-28T12:00:00+09:00",0,"2026-09-27",published_manifest=manifest)
    assert result["queue"] == []
    assert result["excluded"]["duplicate_keyword"] == 1

def test_same_day_published_manifest_capacity_overrides_stale_counter():
    manifest=published_manifest(candidateIds=["keyword:기존발행"],urls=["/kor/column/existing/"])
    result=prepare_queue([launch_row("새 도구","/kor/column/new/")],set(),set(),1,"2026-09-28T12:00:00+09:00",0,"2026-09-13",published_manifest=manifest)
    assert result["queue"] == []
    assert result["excluded"]["daily_limit"] == 1

def test_manifest_usage_reduces_queue_to_remaining_capacity():
    manifest=published_manifest(candidateIds=["keyword:already-published"],urls=["/kor/column/already-published/"],dailyLimit=2)
    rows=[launch_row("산책길지도","/kor/column/walking-route/"),launch_row("등산준비목록","/kor/column/hiking-checklist/")]
    result=prepare_queue(rows,set(),set(),2,"2026-09-28T12:00:00+09:00",0,"2026-09-13",published_manifest=manifest)
    assert len(result["queue"]) == 1

def test_same_day_published_manifest_unknown_candidate_still_consumes_capacity():
    manifest=published_manifest(candidateIds=["external:opaque-id"],urls=[])
    manifest.pop("publishedToday")
    result=prepare_queue([launch_row("새 도구","/kor/column/new/")],set(),set(),1,"2026-09-28T12:00:00+09:00",0,"2026-09-13",published_manifest=manifest)
    assert result["queue"] == []
    assert result["excluded"]["daily_limit"] == 1

def test_previous_day_manifest_does_not_consume_slot_but_still_dedupes_published_page():
    manifest=published_manifest(candidateIds=["keyword:1688구매대행"],urls=["/kor/column/1688gumaedaehaeng/"])
    rows=[launch_row("1688구매대행","/kor/column/1688gumaedaehaeng/","90"),launch_row("새 후보","/kor/column/new/","80")]
    result=prepare_queue(rows,set(),set(),1,"2026-09-29T12:00:00+09:00",1,"2026-09-28",published_manifest=manifest)
    assert [item["keyword"] for item in result["queue"]] == ["새 후보"]
    assert result["excluded"]["duplicate_keyword"] == 1

def test_distinct_unpublished_candidate_remains_eligible_when_capacity_is_available():
    result=prepare_queue([launch_row("새 후보","/kor/column/new/")],set(),set(),1,"2026-09-29T12:00:00+09:00",0,"2026-09-28",published_manifest=published_manifest())
    assert [item["keyword"] for item in result["queue"]] == ["새 후보"]

def test_manifest_capacity_uses_korea_local_date_for_utc_selection_time():
    result=prepare_queue([launch_row("새 후보","/kor/column/new/")],set(),set(),1,"2026-09-28T15:30:00+00:00",0,"2026-09-28",published_manifest=published_manifest())
    assert [item["keyword"] for item in result["queue"]] == ["새 후보"]

def test_main_reads_committed_published_manifest_before_writing_queue(tmp_path, monkeypatch):
    data=tmp_path/"data"
    data.mkdir()
    with (data/"keywords_master.csv").open("w",encoding="utf-8",newline="") as handle:
        writer=csv.DictWriter(handle,fieldnames=["keyword","status","score_valid","opportunity_score","confidence","category","action","content_types","overlap","suggested_url"])
        writer.writeheader()
        writer.writerow(launch_row("1688구매대행","/kor/column/1688gumaedaehaeng/","59.92"))
    (data/"content-index-ko.json").write_text("[]",encoding="utf-8")
    (data/"published_keywords.json").write_text("[]",encoding="utf-8")
    (data/"content-launch-counter.json").write_text(json.dumps({"date":"2026-09-13","launchedCount":1,"dailyLimit":1}),encoding="utf-8")
    (data/"content-launch-manifest.json").write_text(json.dumps(published_manifest()),encoding="utf-8")
    monkeypatch.setattr("sys.argv",["prepare_keyword_launch.py","--root",str(tmp_path),"--selected-at","2026-09-28T12:00:00+09:00"])
    prepare_keyword_launch.main()
    output=json.loads((data/"content-launch-queue.json").read_text(encoding="utf-8"))
    assert output["queue"] == []
    assert output["excluded"]["daily_limit"] == 1
