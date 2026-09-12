from datetime import datetime, timezone

from scripts.keyword_hunter_exploration import (
    enforce_candidate_shares,
    exploration_budgets,
    novelty_score,
    recovery_active,
    recovery_seed_fragments,
    select_exploration_seeds,
    update_history,
)


def test_exploration_budget_uses_40_30_20_10():
    assert exploration_budgets(40) == {
        "new_theme": 16,
        "promising": 12,
        "winner": 8,
        "backlog": 4,
    }


def test_novelty_rewards_new_category_and_penalizes_recent_repeat():
    master=[{"keyword":"캠핑 의자", "category":"camp", "cluster":"캠핑"}]
    history=[{"seeds":[{"keyword":"캠핑 텐트", "category":"camp", "cluster":"캠핑"}]}]
    fresh={"keyword":"반려식물 병충해", "category":"plant", "cluster":"반려식물"}
    repeat={"keyword":"캠핑 텐트", "category":"camp", "cluster":"캠핑"}
    assert novelty_score(fresh,master,history) >= 70
    assert novelty_score(repeat,master,history) < 40


def test_selection_is_reproducible_breadth_first_and_avoids_recent_seeds():
    candidates=[]
    for i in range(60):
        candidates.append({"keyword":f"새영역 {i}","category":f"cat{i%12}","cluster":f"cluster{i}","source":"rss","bucket":"new_theme"})
    history=[{"seeds":[{"keyword":"새영역 0","category":"cat0","cluster":"cluster0"}]}]
    now=datetime(2026,9,10,tzinfo=timezone.utc)
    first=select_exploration_seeds(candidates,[],history,40,1234,now)
    second=select_exploration_seeds(candidates,[],history,40,1234,now)
    assert [x["keyword"] for x in first] == [x["keyword"] for x in second]
    assert "새영역 0" not in {x["keyword"] for x in first}
    assert len({x["cluster"] for x in first}) >= 10
    assert max(sum(x["category"]==cat for x in first) for cat in {x["category"] for x in first}) <= 8
    assert sum(x["bucket"]=="new_theme" for x in first) >= 16


def test_history_retains_only_ten_runs():
    history=[]
    for i in range(12):
        history=update_history(history,{"run_id":str(i)})
    assert len(history)==10
    assert history[0]["run_id"]=="2"


def test_selection_limits_one_seed_source_when_alternatives_exist():
    candidates=[]
    for source in ("rss","search_ads_related"):
        for i in range(30):
            candidates.append({"keyword":f"{source} {i}","category":f"cat{i%10}","cluster":f"{source}-{i}","source":source,"bucket":"new_theme"})
    selected=select_exploration_seeds(candidates,[],[],40,77,datetime(2026,9,10,tzinfo=timezone.utc))
    assert max(sum(x["source"]==source for x in selected) for source in {x["source"] for x in selected}) <= 20


def test_final_candidate_share_caps_winner_category_at_thirty_percent():
    rows=[{"keyword":f"자동차 {i}","category":"car","opportunity_score":i} for i in range(23)]
    rows += [{"keyword":f"기타 {i}","category":f"other{i%8}","opportunity_score":i} for i in range(32)]
    kept,dropped=enforce_candidate_shares(rows,[{"keyword":"자동차 22","category":"car"}])
    car=sum(r["category"]=="car" for r in kept)
    assert car/len(kept) <= .30
    assert any(r["category"]=="car" for r in dropped)


def test_zero_result_recovery_activates_after_required_streaks():
    state=recovery_active([{"keywords":[],"winners":[]} for _ in range(3)])
    assert state["active"] is True
    assert state["new_zero_streak"]==3
    assert state["winner_zero_streak"]==3
    assert state["new_theme_ratio"]==70


def test_recovery_fragments_long_observed_title_without_invented_suffixes():
    seed={"keyword":"정수기 렌탈 계약해지·관리 미흡 소비자피해","source":"PUBLIC_RSS","category":"consumer"}
    rows=recovery_seed_fragments([seed])
    assert rows
    assert all(len(r["keyword"])<=20 for r in rows)
    assert all(r["source"]=="ZERO_RECOVERY_EXTERNAL_FRAGMENT" for r in rows)
    assert all(not any(x in r["keyword"] for x in ["추천","비용","방법"]) for r in rows)


def test_recovery_selection_allocates_at_least_seventy_percent_new_themes():
    candidates=[]
    for bucket in ("new_theme","promising","winner","backlog"):
        for i in range(40):
            candidates.append({"keyword":f"{bucket} {i}","category":f"cat{i%12}","cluster":f"{bucket}-{i}","source":"rss","bucket":bucket})
    selected=select_exploration_seeds(candidates,[],[],40,7,datetime(2026,9,10,tzinfo=timezone.utc),recovery=True)
    assert sum(x["bucket"]=="new_theme" for x in selected)>=28
