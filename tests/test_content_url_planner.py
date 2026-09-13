from scripts.content_url_planner import plan_url

def test_planner_routes_and_is_deterministic():
    assert plan_url("단위계산기", "tools", "calculator/tool", "calculator/tool").startswith("/kor/util/")
    assert plan_url("정수기비교", "recovery", "comparison", "comparison") == plan_url("정수기비교", "recovery", "comparison", "comparison")
    assert plan_url("팰월드 지도", "game", "evergreen", "informational").startswith("/kor/game/")

def test_planner_never_returns_empty_slug():
    assert plan_url("!!!", "topic", "", "").endswith("/content/")
