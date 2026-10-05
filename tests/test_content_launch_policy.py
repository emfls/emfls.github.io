import copy
import csv
from pathlib import Path

from scripts.content_launch_policy import select_launch_candidate, normalize_keyword
from scripts.content_launch_guard import validate_launch
from scripts.prepare_keyword_launch import prepare_queue

def row(**kw):
    base = {"keyword":"계산기", "status":"NEW", "score_valid":"True", "opportunity_score":"80", "confidence":"HIGH", "category":"tools", "action":"NEW_PAGE", "content_types":"calculator/tool|evergreen", "closest_url":"", "overlap":"NO_OVERLAP"}
    base.update(kw); return base

def current_master_rows():
    master_path = Path(__file__).resolve().parents[1] / "data" / "keywords_master.csv"
    with master_path.open(encoding="utf-8-sig", newline="") as source:
        return {item["keyword"]: item for item in csv.DictReader(source)}

def blocked_before_ymyl(result):
    return any(result["excluded"][stage] for stage in ("invalid_score", "ineligible", "stale_winner"))

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


def test_default_launch_policy_uses_three_daily_publication_slots():
    rows = [
        row(keyword=f"안전한도구{index}", suggested_url=f"/kor/column/safe-{index}/")
        for index in range(4)
    ]
    result = select_launch_candidate(rows)
    assert result["dailyLimit"] == 3
    assert result.get("remainingCapacity") == 3
    assert len(result["queue"]) == 3


def test_launch_policy_reports_remaining_capacity_and_blocks_at_three():
    rows = [
        row(keyword=f"도구안내{index}", suggested_url=f"/kor/column/tool-{index}/")
        for index in range(4)
    ]
    for published, expected in ((0, 3), (1, 2), (2, 1), (3, 0), (4, 0)):
        result = select_launch_candidate(rows, daily_limit=3, launched_count=published)
        assert result.get("remainingCapacity") == expected
        assert len(result["queue"]) == expected
        if published >= 3:
            assert result["excluded"]["daily_limit"] == 1

def test_ymyl_calculators_block_but_unit_calculator_allowed():
    blocked=["원천징수계산기","3.3%계산기","퇴직금세금계산기","부가세계산기","급여일할계산기","연장수당계산기","휴일수당계산기"]
    for keyword in blocked:
        result=select_launch_candidate([row(keyword=keyword,suggested_url="/kor/util/x.html")],daily_limit=1)
        assert result["queue"] == [] and result["excluded"]["ymyl"] == 1
    assert select_launch_candidate([row(keyword="단위계산기",suggested_url="/kor/util/unit.html")],daily_limit=1)["queue"]

def test_parental_leave_application_variants_are_blocked_as_ymyl():
    for keyword in ("육아휴직신청서양식", "육아휴직신청서", "육아휴직급여"):
        result = select_launch_candidate(
            [row(keyword=keyword, category="recovery:인지대", content_types="form/template", suggested_url="/kor/parenting/x.html")],
            daily_limit=1,
        )
        assert result["queue"] == []
        assert result["excluded"]["ymyl"] == 1

def test_clear_legal_debt_and_family_leave_intent_is_blocked_even_in_noisy_recovery_categories():
    cases = [
        ("출산휴가신청서", "recovery:인지대"),
        ("배우자출산휴가신청서", "recovery:인지대"),
        ("가압류비용", "recovery:인지대"),
        ("지급명령신청", "recovery:인지대"),
        ("행정소송비용", "recovery:인지대"),
        ("불법사채해결", "recovery:피해구제"),
        ("신용회복위원회채무조정", "recovery:피해구제"),
        ("개인회생신청자격", "recovery:피해구제"),
        ("재산명시신청서", "recovery:인지대"),
        ("사실조회신청서", "recovery:인지대"),
        ("통장압류방법", "recovery:피해구제"),
        ("채권추심비용", "recovery:피해구제"),
        ("저당권설정자", "recovery:인지대"),
    ]

    for keyword, category in cases:
        result = select_launch_candidate(
            [row(keyword=keyword, category=category, suggested_url="/kor/guide/example.html")],
            daily_limit=1,
        )
        assert result["queue"] == [], keyword
        assert result["excluded"]["ymyl"] == 1, keyword

def test_clear_legal_content_type_blocks_candidate_without_noisy_category_false_signal():
    result = select_launch_candidate(
        [row(keyword="업무 절차 안내", category="recovery:인지대", content_types="legal/procedure", suggested_url="/kor/guide/legal-process.html")],
        daily_limit=1,
    )
    assert result["queue"] == []
    assert result["excluded"]["ymyl"] == 1

def test_real_master_tax_and_labor_entitlement_queries_fail_closed_despite_noisy_category():
    cases = (
        ("연차계산기", "calculator/tool|evergreen|informational"),
        ("연차수당계산기", "calculator/tool|evergreen|informational"),
        ("연차계산법", "calculator/tool|evergreen|informational"),
        ("원천세계산기", "calculator/tool|evergreen|informational"),
        ("연차수당계산법", "calculator/tool|informational|trending"),
        ("회계년도연차계산기", "calculator/tool|evergreen|informational"),
        ("연차계산", "calculator/tool|evergreen|informational"),
        ("시급계산기", "calculator/tool|evergreen|informational"),
        ("갑근세계산기", "calculator/tool|evergreen|informational"),
        ("시급계산", "calculator/tool|evergreen|informational"),
        ("연말정산하는법", "how-to|informational|trending"),
        ("노동청신고방법", "evergreen|how-to|informational"),
        ("실수령액계산기", "calculator/tool|evergreen|informational"),
        ("시간외수당계산기", "calculator/tool|evergreen|informational"),
        ("연차휴가계산기", "calculator/tool|evergreen|informational"),
        ("연차일수계산", "calculator/tool|evergreen|informational"),
        ("월급계산법", "calculator/tool|evergreen|informational"),
        ("연봉계산기", "calculator/tool|evergreen|informational"),
        ("연장근로수당계산", "calculator/tool|evergreen|informational"),
        ("조기재취업수당모의계산", "calculator/tool|evergreen|informational"),
        ("수급자격신청자온라인교육", "evergreen|how-to|informational"),
        ("증여세계산기", "calculator/tool|evergreen|informational"),
        ("알바비계산기", "calculator/tool|evergreen|informational"),
        ("세후계산기", "calculator/tool|evergreen|informational"),
        ("월급계산기", "calculator/tool|evergreen|informational"),
        ("전자계산서발행", "calculator/tool|evergreen|informational"),
        ("계산서발행", "calculator/tool|evergreen|informational"),
        ("통신판매업신고방법", "evergreen|how-to|informational"),
        ("양도세계산기", "calculator/tool|evergreen|informational"),
        ("사업소득계산기", "calculator/tool|informational|trending"),
        ("연말정산계산기", "calculator/tool|informational|trending"),
        ("월급일할계산", "calculator/tool|evergreen|informational"),
        ("야간근로수당계산", "calculator/tool|informational|trending"),
        ("야간수당계산", "calculator/tool|evergreen|informational"),
        ("휴일근무수당계산", "calculator/tool|informational|trending"),
        ("야간수당계산기", "calculator/tool|evergreen|informational"),
        ("월급계산", "calculator/tool|evergreen|informational"),
        ("연차수당계산", "calculator/tool|evergreen|informational"),
        ("미사용연차수당계산", "calculator/tool|evergreen|informational"),
        ("월급세후계산기", "calculator/tool|evergreen|informational"),
    )

    for index, (keyword, content_types) in enumerate(cases):
        result = select_launch_candidate(
            [row(keyword=keyword, category="recovery:세금", content_types=content_types, suggested_url=f"/kor/guide/master-{index}.html")],
            daily_limit=1,
        )
        assert result["queue"] == [], keyword
        assert result["excluded"]["ymyl"] == 1, keyword

def test_real_master_non_ymyl_controls_remain_eligible_despite_noisy_category():
    cases = (
        ("근무일수계산기", "calculator/tool|evergreen|informational"),
        ("글자수계산기", "calculator/tool|informational|trending"),
        ("지문인식출퇴근기록기", "evergreen|informational"),
        ("근무일수계산", "calculator/tool|evergreen|informational"),
    )

    for index, (keyword, content_types) in enumerate(cases):
        result = select_launch_candidate(
            [row(keyword=keyword, category="recovery:세금", content_types=content_types, suggested_url=f"/kor/tool/master-{index}.html")],
            daily_limit=1,
        )
        assert [item["keyword"] for item in result["queue"]] == [keyword]
        assert result["excluded"]["ymyl"] == 0

def test_noisy_recovery_category_alone_does_not_block_safe_query():
    result = select_launch_candidate(
        [row(keyword="글자수계산기", category="recovery:세금", suggested_url="/kor/util/character-count.html")],
        daily_limit=1,
    )
    assert [item["keyword"] for item in result["queue"]] == ["글자수계산기"]
    assert result["excluded"]["ymyl"] == 0

def test_safe_recovery_queries_are_not_assumed_to_be_ymyl():
    for keyword in (
        "근무기간계산기",
        "시급한문서복구방법",
    ):
        result = select_launch_candidate(
            [row(keyword=keyword, category="recovery:인지대", suggested_url="/kor/guide/example.html")],
            daily_limit=1,
        )
        assert [item["keyword"] for item in result["queue"]] == [keyword]
        assert result["excluded"]["ymyl"] == 0

def test_vacation_application_form_candidates_fail_closed_for_labor_review():
    for keyword in ("휴가신청서", "휴가신청서양식"):
        result = select_launch_candidate(
            [row(keyword=keyword, category="recovery:인지대", suggested_url="/kor/guide/leave-request.html")],
            daily_limit=1,
        )
        assert result["queue"] == [], keyword
        assert result["excluded"]["ymyl"] == 1, keyword

def test_labor_professional_fee_queries_fail_closed_for_labor_review():
    for keyword in ("노무사상담비용", "노무사비용"):
        result = select_launch_candidate(
            [row(keyword=keyword, category="recovery:세금", content_types="commercial|evergreen|informational", suggested_url="/kor/report/labor-cost.html")],
            daily_limit=1,
        )
        assert result["queue"] == [], keyword
        assert result["excluded"]["ymyl"] == 1, keyword

def test_high_risk_candidate_fixtures_fail_closed_before_queue_selection():
    for index, keyword in enumerate(("회생신청", "호주워홀비자신청", "호주워홀신청", "못받은돈받아드립니다", "휴가신청서양식", "노무사상담비용", "노무사비용")):
        candidate = row(keyword=keyword, category="recovery:regression-control", suggested_url=f"/kor/guide/high-risk-{index}.html")
        result = prepare_queue(
            [candidate],
            existing_urls=set(),
            published_keywords=set(),
            daily_limit=1,
            selected_at="2026-10-03T12:00:00+09:00",
            editorial_decisions=[],
            published_manifest={},
        )
        assert result["queue"] == [], keyword
        assert result["excluded"]["ymyl"] == 1, keyword

def test_vehicle_transfer_registration_application_is_blocked_as_legal_ymyl():
    candidate = row(keyword="이전등록신청서", category="recovery:regression-control", suggested_url="/kor/guide/vehicle-transfer.html")
    result = prepare_queue(
        [candidate],
        existing_urls=set(),
        published_keywords=set(),
        daily_limit=1,
        selected_at="2026-10-03T12:00:00+09:00",
        editorial_decisions=[],
        published_manifest={},
    )
    assert result["queue"] == []
    assert result["excluded"]["ymyl"] == 1

def test_consumer_and_vehicle_procedure_fixtures_are_blocked_as_legal_ymyl():
    keywords = (
        "피해구제신청",
        "자동차등록비용",
        "자동차구조변경비용",
        "자동차종합검사비용",
        "자동차정기검사비용",
        "자동차검사대행비용",
        "폐차서류",
        "자동차폐차서류",
        "폐차방법",
        "자동차폐차방법",
        "폐차하는법",
        "자동차매도서류",
    )
    for index, keyword in enumerate(keywords):
        candidate = row(keyword=keyword, category="recovery:regression-control", suggested_url=f"/kor/guide/vehicle-procedure-{index}.html")
        result = prepare_queue(
            [candidate],
            existing_urls=set(),
            published_keywords=set(),
            daily_limit=1,
            selected_at="2026-10-03T12:00:00+09:00",
            editorial_decisions=[],
            published_manifest={},
        )
        assert result["queue"] == [], keyword
        assert result["excluded"]["ymyl"] == 1, keyword

def test_current_master_launch_eligible_high_risk_rows_fail_closed():
    keywords = (
        "회생신청", "호주워홀비자신청", "호주워홀신청", "못받은돈받아드립니다", "휴가신청서양식",
        "노무사상담비용", "노무사비용", "이전등록신청서", "피해구제신청", "자동차등록비용",
        "자동차구조변경비용", "자동차종합검사비용", "자동차정기검사비용", "자동차검사대행비용",
        "폐차서류", "자동차폐차서류", "폐차방법", "자동차폐차방법", "폐차하는법", "자동차매도서류",
    )
    rows = current_master_rows()

    for keyword in keywords:
        candidate = rows.get(keyword)
        if candidate is None:
            continue
        result = prepare_queue(
            [candidate],
            existing_urls=set(),
            published_keywords=set(),
            daily_limit=1,
            selected_at="2026-10-03T12:00:00+09:00",
            editorial_decisions=[],
            published_manifest={},
        )
        assert result["queue"] == [], keyword
        if not blocked_before_ymyl(result):
            assert result["excluded"]["ymyl"] == 1, keyword

def test_safe_control_fixtures_remain_eligible_with_noisy_recovery_category():
    keywords = ("서류양식", "글자수계산기", "자동차점검비용")
    for index, keyword in enumerate(keywords):
        candidate = row(keyword=keyword, category="recovery:regression-control", suggested_url=f"/kor/guide/safe-control-{index}.html")
        result = prepare_queue(
            [candidate],
            existing_urls=set(),
            published_keywords=set(),
            daily_limit=1,
            selected_at="2026-10-03T12:00:00+09:00",
            editorial_decisions=[],
            published_manifest={},
        )
        assert [item["keyword"] for item in result["queue"]] == [keyword]
        assert result["excluded"]["ymyl"] == 0

def test_general_vacation_planning_remains_queue_eligible():
    result = select_launch_candidate(
        [row(keyword="여름휴가계획", category="recovery:인지대", suggested_url="/kor/guide/summer-vacation-plan.html")],
        daily_limit=1,
    )
    assert [item["keyword"] for item in result["queue"]] == ["여름휴가계획"]
    assert result["excluded"]["ymyl"] == 0

def test_latest_master_working_holiday_application_rows_fail_closed_before_overlap_gate():
    # These exact rows were present in the 2026-09-30 latest-main master blob;
    # the local branch snapshot predates that generated 20-row update.
    cases = (
        ("호주워킹홀리데이신청", "37.35", "LOW_OVERLAP"),
        ("캐나다워킹홀리데이신청", "38.43", "LOW_OVERLAP"),
    )

    for keyword, opportunity_score, overlap in cases:
        candidate = row(
            keyword=keyword,
            category="recovery:미국",
            score_valid="True",
            opportunity_score=opportunity_score,
            action="NEW_PAGE",
            status="NEW",
            overlap=overlap,
            content_types="evergreen|how-to|informational",
            suggested_url="/kor/report/visa/working-holiday.html",
        )
        result = select_launch_candidate([candidate], daily_limit=1)
        assert result["queue"] == [], keyword
        assert result["excluded"]["ymyl"] == 1, keyword

def test_spaced_specific_visa_working_holiday_and_debt_signals_are_excluded_as_ymyl():
    cases = (
        ("비자 신청", "/kor/report/visa/application.html"),
        ("워킹홀리데이 신청", "/kor/report/visa/working-holiday.html"),
        ("못 받은 돈", "/kor/report/legal/unpaid-money.html"),
    )

    for keyword, suggested_url in cases:
        candidate = row(
            keyword=keyword,
            category="recovery:미국",
            score_valid="True",
            opportunity_score="42.5",
            action="NEW_PAGE",
            status="NEW",
            overlap="NO_OVERLAP",
            suggested_url=suggested_url,
        )
        result = select_launch_candidate([candidate], daily_limit=1)
        assert result["queue"] == [], keyword
        assert result["excluded"]["ymyl"] == 1, keyword

def test_numeric_3_3_signal_stays_literal_and_does_not_match_33():
    exact_signal = select_launch_candidate(
        [row(keyword="3.3%계산기", suggested_url="/kor/util/tax.html")],
        daily_limit=1,
    )
    assert exact_signal["queue"] == []
    assert exact_signal["excluded"]["ymyl"] == 1

    numeric_near_miss = select_launch_candidate(
        [row(keyword="33계산기", suggested_url="/kor/util/number-33.html")],
        daily_limit=1,
    )
    assert [item["keyword"] for item in numeric_near_miss["queue"]] == ["33계산기"]
    assert numeric_near_miss["excluded"]["ymyl"] == 0

def test_hangul_signal_normalization_respects_keyword_and_content_type_boundaries():
    split_fields = select_launch_candidate(
        [row(keyword="비자", content_types="신청", category="recovery:미국", suggested_url="/kor/report/visa/keyword.html")],
        daily_limit=1,
    )
    assert [item["keyword"] for item in split_fields["queue"]] == ["비자"]
    assert split_fields["excluded"]["ymyl"] == 0

    for keyword, suggested_url in (
        ("비자 신청", "/kor/report/visa/application.html"),
        ("워킹홀리데이 신청", "/kor/report/visa/working-holiday.html"),
        ("못 받은 돈", "/kor/report/legal/unpaid-money.html"),
    ):
        result = select_launch_candidate(
            [row(keyword=keyword, suggested_url=suggested_url)],
            daily_limit=1,
        )
        assert result["queue"] == [], keyword
        assert result["excluded"]["ymyl"] == 1, keyword

def test_current_master_safe_rows_are_not_misclassified_as_ymyl_when_eligible():
    rows = current_master_rows()
    for keyword in ("근무일수계산기", "글자수계산기", "지문인식출퇴근기록기", "근무일수계산"):
        candidate = rows.get(keyword)
        if candidate is None:
            continue
        result = prepare_queue(
            [candidate],
            existing_urls=set(),
            published_keywords=set(),
            daily_limit=1,
            selected_at="2026-10-03T12:00:00+09:00",
            editorial_decisions=[],
            published_manifest={},
        )
        if not blocked_before_ymyl(result):
            assert result["excluded"]["ymyl"] == 0, keyword

def test_explicit_ymyl_category_and_safe_controls_keep_expected_eligibility():
    explicit_category = select_launch_candidate(
        [row(keyword="단순 안내", category="finance", suggested_url="/kor/guide/finance.html")],
        daily_limit=1,
    )
    assert explicit_category["queue"] == []
    assert explicit_category["excluded"]["ymyl"] == 1

    for keyword, category, content_types, url in (
        ("단위계산기", "tools", "calculator/tool", "/kor/util/unit.html"),
        ("산책길지도", "outdoors", "informational", "/kor/column/walking-route/"),
    ):
        result = select_launch_candidate(
            [row(keyword=keyword, category=category, content_types=content_types, suggested_url=url)],
            daily_limit=1,
        )
        assert [item["keyword"] for item in result["queue"]] == [keyword]
        assert result["excluded"]["ymyl"] == 0

def test_ymyl_queue_block_does_not_disable_separately_approved_manual_launch(tmp_path):
    url = "/kor/report/parenting/manual.html"
    relative_path = "kor/report/parenting/manual.html"
    html_path = tmp_path / relative_path
    html_path.parent.mkdir(parents=True)
    html_path.write_text(
        '<html><head><meta name="viewport" content="width=device-width">'
        '<title>수동 승인 가이드</title>'
        f'<link rel="canonical" href="https://emfls.github.io{url}">'
        '<script type="application/ld+json">{}</script></head>'
        '<body><h1>수동 승인 가이드</h1></body></html>',
        encoding="utf-8",
    )
    sitemap_path = "kor/report/parenting/sitemap.xml"
    hub_path = "kor/report/parenting/index.html"
    for relative in (sitemap_path, hub_path):
        (tmp_path / relative).parent.mkdir(parents=True, exist_ok=True)
    (tmp_path / sitemap_path).write_text(
        f"<urlset><loc>https://emfls.github.io{url}</loc></urlset>", encoding="utf-8"
    )
    (tmp_path / hub_path).write_text(f'<a href="{url}">가이드</a>', encoding="utf-8")
    manifest = {
        "urls": [url],
        "contentPaths": [relative_path],
        "sitemapPaths": [sitemap_path],
        "hubPaths": [hub_path],
    }
    assert validate_launch(tmp_path, manifest, [("A", relative_path)]) == []

def test_non_ymyl_candidate_remains_eligible_after_parental_leave_block():
    result = select_launch_candidate(
        [row(keyword="산책길지도", category="outdoors", content_types="informational", suggested_url="/kor/column/walking-route/")],
        daily_limit=1,
    )
    assert [item["keyword"] for item in result["queue"]] == ["산책길지도"]

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

# These real-master checks force otherwise-eligible fixtures through keyword policy gates, independent of volatile freshness scores.

def launchable_master_row(candidate, suggested_url):
    """Keep policy tests independent of the volatile DataLab freshness snapshot."""
    return {
        **candidate,
        "score_valid": "True",
        "opportunity_score": "1",
        "action": "NEW_PAGE",
        "status": "NEW",
        "overlap": "NO_OVERLAP",
        "suggested_url": suggested_url,
    }

def test_master_high_risk_keywords_fail_closed_before_queue_selection():
    master_path = Path(__file__).resolve().parents[1] / "data" / "keywords_master.csv"
    with master_path.open(encoding="utf-8-sig", newline="") as source:
        rows = {item["keyword"]: item for item in csv.DictReader(source)}

    for keyword in ("회생신청", "호주워홀비자신청", "호주워홀신청", "못받은돈받아드립니다", "휴가신청서양식", "노무사상담비용", "노무사비용"):
        candidate = launchable_master_row(rows[keyword], f"/kor/guide/master-{keyword}.html")
        result = prepare_queue(
            [candidate],
            existing_urls=set(),
            published_keywords=set(),
            daily_limit=1,
            selected_at="2026-09-30T15:50:00+09:00",
            editorial_decisions=[],
            published_manifest={},
        )
        assert result["queue"] == [], keyword
        assert result["excluded"]["ymyl"] == 1, keyword

def test_master_vehicle_transfer_registration_application_is_blocked_as_legal_ymyl():
    master_path = Path(__file__).resolve().parents[1] / "data" / "keywords_master.csv"
    with master_path.open(encoding="utf-8-sig", newline="") as source:
        candidate = next(item for item in csv.DictReader(source) if item["keyword"] == "이전등록신청서")

    candidate = launchable_master_row(candidate, "/kor/guide/vehicle/transfer-registration.html")

    result = prepare_queue(
        [candidate],
        existing_urls=set(),
        published_keywords=set(),
        daily_limit=1,
        selected_at="2026-09-30T15:50:00+09:00",
        editorial_decisions=[],
        published_manifest={},
    )
    assert result["queue"] == []
    assert result["excluded"]["ymyl"] == 1

def test_master_consumer_and_vehicle_procedure_keywords_are_blocked_as_legal_ymyl():
    keywords = (
        "피해구제신청",
        "자동차등록비용",
        "자동차구조변경비용",
        "자동차종합검사비용",
        "자동차정기검사비용",
        "자동차검사대행비용",
        "폐차서류",
        "자동차폐차서류",
        "폐차방법",
        "자동차폐차방법",
        "폐차하는법",
        "자동차매도서류",
    )
    master_path = Path(__file__).resolve().parents[1] / "data" / "keywords_master.csv"
    with master_path.open(encoding="utf-8-sig", newline="") as source:
        rows = {item["keyword"]: item for item in csv.DictReader(source)}

    assert set(keywords) <= rows.keys()
    failures = []
    for keyword in keywords:
        candidate = launchable_master_row(rows[keyword], f"/kor/guide/master-{keyword}.html")

        result = prepare_queue(
            [candidate],
            existing_urls=set(),
            published_keywords=set(),
            daily_limit=1,
            selected_at="2026-09-30T15:50:00+09:00",
            editorial_decisions=[],
            published_manifest={},
        )
        if result["queue"] or result["excluded"]["ymyl"] != 1:
            failures.append((keyword, result["queue"], result["excluded"]))

    assert failures == []

def test_master_safe_controls_remain_queue_eligible():
    master_path = Path(__file__).resolve().parents[1] / "data" / "keywords_master.csv"
    with master_path.open(encoding="utf-8-sig", newline="") as source:
        rows = {item["keyword"]: item for item in csv.DictReader(source)}

    for keyword in ("근무일수계산기", "글자수계산기", "지문인식출퇴근기록기", "근무일수계산"):
        candidate = launchable_master_row(rows[keyword], f"/kor/tool/master-{keyword}.html")
        result = prepare_queue(
            [candidate],
            existing_urls=set(),
            published_keywords=set(),
            daily_limit=1,
            selected_at="2026-09-30T15:50:00+09:00",
            editorial_decisions=[],
            published_manifest={},
        )
        assert [item["keyword"] for item in result["queue"]] == [keyword]
        assert result["excluded"]["ymyl"] == 0
