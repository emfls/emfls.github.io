import copy
from scripts.content_launch_policy import select_launch_candidate, normalize_keyword

def row(**kw):
    base = {"keyword":"계산기", "status":"NEW", "score_valid":"True", "opportunity_score":"80", "confidence":"HIGH", "category":"tools", "action":"NEW_PAGE", "content_types":"calculator/tool|evergreen", "closest_url":"", "overlap":"NO_OVERLAP"}
    base.update(kw); return base

def test_policy_blocks_duplicates_invalid_stale_ymyl_and_caps_one():
    rows=[row(keyword="기존", suggested_url="/kor/util/existing/index.html"), row(keyword="새 도구", suggested_url="/kor/util/new/index.html"), row(keyword="새 금융", category="finance", content_types="commercial", suggested_url="/kor/finance/new.html"), row(keyword="무효", score_valid="False"), row(keyword="오래된", status="WINNER", last_checked="2020-01-01")]
    result=select_launch_candidate(rows, existing_urls={"/kor/util/existing/index.html"}, published_keywords={"계산기"}, daily_limit=1)
    assert len(result["queue"]) == 1
    assert result["queue"][0]["keyword"] == "새 도구"
    assert result["excluded"]["duplicate_url"] >= 1

def test_tool_priority_and_determinism():
    rows=[row(keyword="가격 추천", category="finance", content_types="commercial", suggested_url="/kor/column/a.html"), row(keyword="단위 계산기", category="tools", content_types="calculator/tool", suggested_url="/kor/util/b/index.html")]
    a=select_launch_candidate(rows, existing_urls=set(), daily_limit=1); b=select_launch_candidate(copy.deepcopy(rows), existing_urls=set(), daily_limit=1)
    assert a == b and a["queue"][0]["keyword"] == "단위 계산기"

def test_normalize_keyword():
    assert normalize_keyword("  ETF-세금! ") == "etf세금"

def test_winner_precedes_candidate():
    rows=[row(keyword="후보",status="CANDIDATE",suggested_url="/kor/a.html"),row(keyword="승자",status="WINNER",suggested_url="/kor/b.html")]
    assert select_launch_candidate(rows,daily_limit=1)["queue"][0]["keyword"] == "승자"

def test_published_similar_intent_and_daily_limit():
    rows=[row(keyword="단위 계산 방법",suggested_url="/kor/a.html")]
    assert select_launch_candidate(rows,published_keywords={"단위계산방법론"})["excluded"]["similar_intent"] == 1
    assert select_launch_candidate(rows,daily_limit=1,launched_count=1)["queue"] == []

def test_queue_size_is_bounded_by_remaining_daily_capacity():
    rows=[row(keyword="산책길지도",suggested_url="/kor/column/walking-route/"),row(keyword="등산준비목록",suggested_url="/kor/column/hiking-checklist/")]
    result=select_launch_candidate(rows,daily_limit=2,launched_count=1)
    assert len(result["queue"]) == 1

def test_ymyl_calculators_block_but_unit_calculator_allowed():
    blocked=["원천징수계산기","3.3%계산기","퇴직금세금계산기","부가세계산기","급여일할계산기","연장수당계산기","휴일수당계산기"]
    for keyword in blocked:
        result=select_launch_candidate([row(keyword=keyword,suggested_url="/kor/util/x.html")],daily_limit=1)
        assert result["queue"] == [] and result["excluded"]["ymyl"] == 1
    assert select_launch_candidate([row(keyword="단위계산기",suggested_url="/kor/util/unit.html")],daily_limit=1)["queue"]

def test_parental_leave_application_keyword_is_excluded_as_ymyl():
    candidate=row(
        keyword="육아휴직신청서양식",
        category="recovery:인지대",
        content_types="evergreen|how-to|informational",
        intent="how-to",
        suggested_url="/kor/column/yugahyujigsinceongseoyangsig/",
    )
    result=select_launch_candidate([candidate],daily_limit=1)
    assert result["queue"] == []
    assert result["excluded"]["ymyl"] == 1

def test_url_identity_blocks_exact_duplicate():
    result=select_launch_candidate([row(keyword="새 후보",suggested_url="/kor/column/example/")],existing_urls={"/kor/column/example/"})
    assert result["queue"] == [] and result["excluded"]["duplicate_url"] == 1

def test_url_identity_matches_trailing_slash_to_index_alias():
    result=select_launch_candidate([row(keyword="새 후보",suggested_url="/kor/column/example/")],existing_urls={"/kor/column/example/index.html"})
    assert result["queue"] == [] and result["excluded"]["duplicate_url"] == 1

def test_url_identity_matches_index_alias_to_trailing_slash():
    result=select_launch_candidate([row(keyword="새 후보",suggested_url="/kor/column/example/index.html")],existing_urls={"/kor/column/example/"})
    assert result["queue"] == [] and result["excluded"]["duplicate_url"] == 1

def test_url_identity_matches_same_site_absolute_query_and_fragment_alias():
    existing={"https://emfls.github.io/kor/column/example/index.html?old=1#section"}
    result=select_launch_candidate([row(keyword="새 후보",suggested_url="/kor/column/example/?new=2#top")],existing_urls=existing)
    assert result["queue"] == [] and result["excluded"]["duplicate_url"] == 1

def test_url_identity_strips_query_and_fragment_before_comparison():
    existing={"/kor/column/example/?old=1#old"}
    result=select_launch_candidate([row(keyword="새 후보",suggested_url="/kor/column/example/?new=2#new")],existing_urls=existing)
    assert result["queue"] == [] and result["excluded"]["duplicate_url"] == 1

def test_url_identity_keeps_html_route_distinct_from_trailing_slash():
    result=select_launch_candidate([row(keyword="새 후보",suggested_url="/kor/column/example.html")],existing_urls={"/kor/column/example/"})
    assert result["queue"] and result["excluded"]["duplicate_url"] == 0

def test_url_identity_preserves_case_sensitive_paths():
    result=select_launch_candidate([row(keyword="새 후보",suggested_url="/kor/column/Example/")],existing_urls={"/kor/column/example/"})
    assert result["queue"] and result["excluded"]["duplicate_url"] == 0

def test_url_identity_does_not_collapse_arbitrary_external_hosts():
    result=select_launch_candidate([row(keyword="새 후보",suggested_url="/kor/column/example/")],existing_urls={"https://other.example/kor/column/example/"})
    assert result["queue"] and result["excluded"]["duplicate_url"] == 0
