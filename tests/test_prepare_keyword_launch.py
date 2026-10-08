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

def test_kst_midnight_rollover_resets_capacity_and_keeps_historical_dedupe():
    rows = [
        launch_row("1688구매대행", "/kor/column/1688gumaedaehaeng/", "95"),
        launch_row("새 도구 하나", "/kor/column/new-one/"),
        launch_row("새 도구 둘", "/kor/column/new-two/"),
        launch_row("새 도구 셋", "/kor/column/new-three/"),
    ]
    manifest = published_manifest(
        runAt="2026-09-13T23:00:00+09:00",
        candidateIds=["keyword:1688구매대행"],
        urls=["/kor/column/1688gumaedaehaeng/"],
    )
    result = prepare_queue(
        rows,
        daily_limit=3,
        selected_at="2026-09-14T00:30:00+09:00",
        launched_count=3,
        counter_date="2026-09-13",
        published_manifest=manifest,
    )
    assert result["publishedToday"] == 0
    assert result["remainingCapacity"] == 3
    assert len(result["queue"]) == 3
    assert result["excluded"]["duplicate_keyword"] == 1

def test_prepare_does_not_increment_launch_count():
    rows=[{"keyword":"무료 계산기","status":"NEW","score_valid":"True","opportunity_score":"90","confidence":"HIGH","category":"tools","action":"NEW_PAGE","content_types":"calculator/tool","suggested_url":"/kor/util/free/index.html"}]
    out=prepare_queue(rows,set(),set(),1,"2026-09-12T00:00:00+09:00",0)
    assert out["dailyLimit"] == 1



def test_default_queue_policy_reports_three_available_slots():
    rows = [launch_row(f"도구안내{index}", f"/kor/column/tool-{index}/") for index in range(4)]
    result = prepare_queue(rows, selected_at="2026-09-12T00:00:00+09:00")
    assert result["dailyLimit"] == 3
    assert result.get("publishedToday") == 0
    assert result.get("remainingCapacity") == 3
    assert len(result["queue"]) == 3


def test_remaining_capacity_never_promotes_editorial_hold_or_ymyl_candidates():
    rows = [
        launch_row("옷장정리방법", "/kor/column/wardrobe-organization/"),
        launch_row("안전한정리순서", "/kor/column/safe-organization/"),
        launch_row("육아휴직급여", "/kor/parenting/leave-pay/"),
    ]
    result = prepare_queue(
        rows,
        daily_limit=3,
        selected_at="2026-09-12T00:00:00+09:00",
        editorial_decisions=[{"keyword": "안전한정리순서", "decision": "HOLD"}],
        published_manifest={},
    )
    assert result.get("remainingCapacity") == 3
    assert [item["keyword"] for item in result["queue"]] == ["옷장정리방법"]
    assert result["excluded"]["editorial_hold"] == 1
    assert result["excluded"]["ymyl"] == 1

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
    rows = [
        launch_row("새 도구 하나", "/kor/column/new-one/"),
        launch_row("새 도구 둘", "/kor/column/new-two/"),
        launch_row("새 도구 셋", "/kor/column/new-three/"),
    ]
    result=prepare_queue(rows,set(),set(),3,"2026-09-28T12:00:00+09:00",0,"2026-09-13",published_manifest=manifest)
    assert result["dailyLimit"] == 3
    assert result.get("publishedToday") == 1
    assert result.get("remainingCapacity") == 2
    assert len(result["queue"]) == 2
    assert result["excluded"]["daily_limit"] == 0

def test_final_manifest_with_missing_run_at_fails_closed_for_daily_capacity():
    manifest=published_manifest(candidateIds=["keyword:already-published"],urls=["/kor/column/already-published/"])
    manifest.pop("runAt")
    result=prepare_queue([launch_row("새 후보","/kor/column/new/")],set(),set(),1,"2026-09-29T12:00:00+09:00",0,"2026-09-13",published_manifest=manifest)
    assert result["queue"] == []
    assert result["excluded"]["daily_limit"] == 1

def test_final_manifest_with_malformed_run_at_fails_closed_for_daily_capacity():
    manifest=published_manifest(candidateIds=["keyword:already-published"],urls=["/kor/column/already-published/"])
    manifest["runAt"]="not-a-date"
    result=prepare_queue([launch_row("새 후보","/kor/column/new/")],set(),set(),1,"2026-09-29T12:00:00+09:00",0,"2026-09-13",published_manifest=manifest)
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
    (data/"content-launch-decisions.json").write_text(json.dumps({"schemaVersion": 1, "decisions": []}),encoding="utf-8")
    monkeypatch.setattr("sys.argv",["prepare_keyword_launch.py","--root",str(tmp_path),"--selected-at","2026-09-28T12:00:00+09:00"])
    prepare_keyword_launch.main()
    output=json.loads((data/"content-launch-queue.json").read_text(encoding="utf-8"))
    assert output["queue"] == []
    assert output["dailyLimit"] == 3
    assert output["publishedToday"] == 1
    assert output["remainingCapacity"] == 2
    assert output["excluded"]["duplicate_keyword"] == 1
    assert output["excluded"]["daily_limit"] == 0



def test_current_keyboard_cleaning_publication_is_preserved_and_leaves_two_slots(tmp_path, monkeypatch):
    current_manifest = {
        "candidateIds": ["keyword:키보드청소방법"],
        "contentPaths": ["kor/report/it/keyboard-cleaning-guide.html"],
        "dailyLimit": 1,
        "hubPaths": ["kor/report/it/index.html"],
        "publishedToday": 1,
        "remainingCapacity": 0,
        "runAt": "2026-10-05T06:48:56+09:00",
        "runId": "P0-20261005-KEYBOARD-CLEANING",
        "schemaVersion": 1,
        "sitemapPaths": ["kor/report/it/sitemap.xml"],
        "status": "PUBLISHED",
        "urls": ["/kor/report/it/keyboard-cleaning-guide.html"],
    }
    before = json.loads(json.dumps(current_manifest))

    data = tmp_path / "data"
    data.mkdir()
    fieldnames = [
        "keyword", "status", "score_valid", "opportunity_score", "confidence",
        "category", "action", "content_types", "overlap", "suggested_url",
    ]
    with (data / "keywords_master.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows([
            launch_row("산책길지도", "/kor/column/walking-route/"),
            launch_row("등산준비목록", "/kor/column/hiking-checklist/"),
            launch_row("계절별옷정리", "/kor/column/seasonal-clothes/"),
            launch_row("캠핑준비표", "/kor/column/camping-checklist/"),
        ])
    (data / "content-index-ko.json").write_text("[]", encoding="utf-8")
    (data / "published_keywords.json").write_text("[]", encoding="utf-8")
    (data / "content-launch-counter.json").write_text(
        json.dumps({"date": "2026-09-13", "launchedCount": 1, "dailyLimit": 1}),
        encoding="utf-8",
    )
    (data / "content-launch-manifest.json").write_text(
        json.dumps(current_manifest, ensure_ascii=False), encoding="utf-8"
    )
    (data / "content-launch-decisions.json").write_text(
        json.dumps({"schemaVersion": 1, "decisions": []}), encoding="utf-8"
    )
    monkeypatch.setattr(
        "sys.argv",
        ["prepare_keyword_launch.py", "--root", str(tmp_path), "--selected-at", "2026-10-05T12:00:00+09:00"],
    )

    prepare_keyword_launch.main()

    output = json.loads((data / "content-launch-queue.json").read_text(encoding="utf-8"))
    assert output["dailyLimit"] == 3
    assert output["publishedToday"] == 1
    assert output["remainingCapacity"] == 2
    assert len(output["queue"]) == 2
    assert json.loads((data / "content-launch-manifest.json").read_text(encoding="utf-8")) == before

def test_current_hold_and_no_new_page_verdicts_are_persisted_and_excluded():
    from pathlib import Path

    decisions_path = Path(__file__).resolve().parents[1] / "data" / "content-launch-decisions.json"
    decisions = prepare_keyword_launch.load_decisions(decisions_path)
    assert decisions.get("인건비계산기") == "HOLD"
    assert decisions.get("엔카중고차구매") == "NO_NEW_PAGE"

    result = prepare_queue(
        [
            launch_row("인건비계산기", "/kor/util/ingeonbigyesangi/"),
            launch_row("엔카중고차구매", "/kor/column/enkajunggocagumae/"),
        ],
        daily_limit=3,
        selected_at="2026-10-08T08:22:46+09:00",
        editorial_decisions=decisions,
        published_manifest={},
    )
    assert result["queue"] == []
    assert result["excluded"]["editorial_hold"] == 1
    assert result["excluded"]["no_new_page"] == 1


def test_no_new_page_decision_is_loaded_and_blocks_exact_candidate(tmp_path):
    path = tmp_path / "content-launch-decisions.json"
    path.write_text(json.dumps({"schemaVersion": 1, "decisions": [
        {"keyword": "엔카중고차구매", "decision": "NO_NEW_PAGE", "reason": "prior editorial decision"}
    ]}), encoding="utf-8")

    decisions = prepare_keyword_launch.load_decisions(path)
    assert decisions.get("엔카중고차구매") == "NO_NEW_PAGE"
    result = prepare_queue(
        [launch_row("엔카중고차구매", "/kor/column/enkajunggocagumae/")],
        daily_limit=1,
        selected_at="2026-10-08T08:22:46+09:00",
        editorial_decisions=decisions,
        published_manifest={},
    )
    assert result["queue"] == []
    assert result["excluded"]["no_new_page"] == 1


def test_airport_priority_exit_is_safe_from_ymyl_but_held_for_no_serp_gap():
    from pathlib import Path

    decisions_path = Path(__file__).resolve().parents[1] / "data" / "content-launch-decisions.json"
    decisions = prepare_keyword_launch.load_decisions(decisions_path)
    assert decisions.get("인천공항교통약자우대출구") == "HOLD"

    result = prepare_queue(
        [launch_row("인천공항교통약자우대출구", "/kor/column/incheon-airport-priority-exit/")],
        daily_limit=1,
        selected_at="2026-10-08T09:36:43+09:00",
        editorial_decisions=decisions,
        published_manifest={},
    )
    assert result["queue"] == []
    assert result["excluded"]["editorial_hold"] == 1
    assert result["excluded"]["ymyl"] == 0


def test_reviewed_travel_and_overseas_candidates_stay_out_of_launch_queue():
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    decisions = prepare_keyword_launch.load_decisions(root / "data" / "content-launch-decisions.json")
    held = ["가을여행추천", "가을여행지추천", "해외구매대행쇼핑몰"]

    assert all(decisions.get(keyword) == "HOLD" for keyword in held)

    result = prepare_queue(
        [
            launch_row("가을여행추천", "/kor/column/gaeulyeohaengcuceon/"),
            launch_row("가을여행지추천", "/kor/column/gaeulyeohaengjicuceon/"),
            launch_row("해외구매대행쇼핑몰", "/kor/column/haeoegumaedaehaengsyopingmol/"),
        ],
        daily_limit=3,
        selected_at="2026-10-08T20:00:00+09:00",
        editorial_decisions=decisions,
        published_manifest={},
    )
    assert result["queue"] == []
    assert result["excluded"]["editorial_hold"] == 3

    persisted_queue = json.loads((root / "data" / "content-launch-queue.json").read_text(encoding="utf-8"))
    queued_keywords = {item["keyword"] for item in persisted_queue["queue"]}
    assert not queued_keywords.intersection(held)
    assert persisted_queue["dailyLimit"] == 3
    assert len(persisted_queue["queue"]) <= 3


def test_invalid_decision_store_fails_closed(tmp_path):
    import pytest

    path = tmp_path / "content-launch-decisions.json"
    with pytest.raises(ValueError):
        prepare_keyword_launch.load_decisions(path)

    path.write_text("{broken", encoding="utf-8")
    with pytest.raises(ValueError):
        prepare_keyword_launch.load_decisions(path)

    path.write_text(json.dumps({"schemaVersion": 1, "decisions": "not-a-list"}), encoding="utf-8")
    with pytest.raises(ValueError):
        prepare_keyword_launch.load_decisions(path)


def test_ymyl_candidate_needs_explicit_approval_and_safe_candidate_stays_eligible():
    candidate = launch_row("연차개수계산기", "/kor/util/yeoncagaesugyesangi/")
    unreviewed = prepare_queue(
        [candidate], daily_limit=1, selected_at="2026-10-08T08:22:46+09:00",
        editorial_decisions=[], published_manifest={},
    )
    assert unreviewed["queue"] == []
    assert unreviewed["excluded"]["ymyl"] == 1

    approved = prepare_queue(
        [candidate], daily_limit=1, selected_at="2026-10-08T08:22:46+09:00",
        editorial_decisions=[{"keyword": "연차개수계산기", "decision": "APPROVE"}], published_manifest={},
    )
    assert [item["keyword"] for item in approved["queue"]] == ["연차개수계산기"]
    assert approved["excluded"]["ymyl"] == 0

    safe = prepare_queue(
        [launch_row("글자수계산기", "/kor/util/character-count/")],
        daily_limit=1, selected_at="2026-10-08T08:22:46+09:00",
        editorial_decisions=[], published_manifest={},
    )
    assert [item["keyword"] for item in safe["queue"]] == ["글자수계산기"]
