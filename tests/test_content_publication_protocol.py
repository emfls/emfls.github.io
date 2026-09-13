from scripts.content_publication_protocol import can_complete_publication, record_publication


def test_publication_requires_all_gates():
    assert can_complete_publication(["tests", "guard", "seo", "pages", "live"]) is True
    assert can_complete_publication(["tests", "guard", "seo", "pages"]) is False


def test_record_publication_is_idempotent_and_does_not_duplicate():
    published = [{"keyword": "기존", "url": "/kor/existing/"}]
    counter = {"date": "2026-09-14", "launchedCount": 0, "dailyLimit": 1}
    published, counter = record_publication(published, counter, "영어공부하기좋은미드", "/kor/canary/", "2026-09-14")
    published2, counter2 = record_publication(published, counter, "영어공부하기좋은미드", "/kor/canary/", "2026-09-14")
    assert published2 == published and counter2 == counter
    assert sum(x["keyword"] == "영어공부하기좋은미드" for x in published2) == 1
    assert counter2["launchedCount"] == 1


def test_counter_rollover_uses_new_date_without_mutating_prepare_state():
    counter = {"date": "2026-09-13", "launchedCount": 1, "dailyLimit": 1}
    _, next_counter = record_publication([], counter, "새 키워드", "/kor/new/", "2026-09-14")
    assert next_counter == {"date": "2026-09-14", "launchedCount": 1, "dailyLimit": 1}
