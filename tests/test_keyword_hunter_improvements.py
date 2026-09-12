from scripts.keyword_hunter_improvements import select_improvement_candidates


def page(url, *, classification=None, cluster=None, cooldown=False, google=None, naver=None, ga4=None, page_score=80):
    return {
        "url": url,
        "classification": classification,
        "cluster": cluster,
        "cooldown": cooldown,
        "pageScore": page_score,
        "google": google or {"status": "NOT_CONNECTED"},
        "naver": naver or {"status": "NOT_AVAILABLE"},
        "ga4": ga4 or {"status": "NOT_CONNECTED"},
    }


def test_selects_only_measured_non_protected_pages():
    payload = {
        "asOf": "2026-09-12",
        "pages": [
            page("/winner", classification="WINNER", cluster="camp", naver={"status": "VERIFIED", "impressions": 500, "clicks": 30, "ctr": .06}),
            page("/cluster-peer", cluster="camp", naver={"status": "VERIFIED", "impressions": 300, "clicks": 20, "ctr": .067}),
            page("/google-position", google={"status": "VERIFIED", "impressions": 80, "clicks": 4, "ctr": .05, "position": 12}),
            page("/naver-low-ctr", naver={"status": "VERIFIED", "impressions": 200, "clicks": 2, "ctr": .01}),
            page("/traffic-structure", ga4={"status": "VERIFIED", "views": 100}, page_score=65),
            page("/cooldown", cooldown=True, naver={"status": "VERIFIED", "impressions": 500, "clicks": 1, "ctr": .002}),
            page("/no-data", page_score=20),
        ],
    }

    result = select_improvement_candidates(payload)
    urls = {row["url"] for row in result["candidates"]}
    assert urls == {"/cluster-peer", "/google-position", "/naver-low-ctr", "/traffic-structure"}
    assert result["candidateCount"] == 4
    assert all(row["reasons"] for row in result["candidates"])


def test_does_not_invent_missing_metrics():
    result = select_improvement_candidates({"asOf": "2026-09-12", "pages": [page("/empty")]})
    assert result == {"schemaVersion": 1, "asOf": "2026-09-12", "candidateCount": 0, "candidates": []}
