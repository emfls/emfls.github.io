from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_keyword_hunter_has_bounded_scheduled_workflow():
    text = (ROOT / ".github/workflows/keyword-hunter.yml").read_text(encoding="utf-8")
    assert 'cron: "17 */2 * * *"' in text
    assert "workflow_dispatch:" in text
    assert "contents: write" in text
    assert "python3 scripts/keyword_hunter.py" in text
    assert "NAVER_SEARCHAD_API_KEY: ${{ secrets.NAVER_SEARCHAD_API_KEY }}" in text
    assert "NAVER_API_HUB_CLIENT_ID: ${{ secrets.NAVER_API_HUB_CLIENT_ID }}" in text
    assert "data/existing-page-improvement-candidates.json" in text
    assert "git add data/keywords_master.csv" in text
    assert "git add ." not in text
    assert ".env" not in text
