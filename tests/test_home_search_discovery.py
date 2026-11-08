from datetime import datetime, timezone
from pathlib import Path
from scripts import refresh_notion_discovery as discovery


def test_hourly_discovery_update_preserves_search_recovery(tmp_path, monkeypatch):
    source = (Path(__file__).resolve().parents[1] / 'index.html').read_text()
    page = tmp_path / 'index.html'
    page.write_text(source)
    monkeypatch.setattr(discovery, 'ROOT', tmp_path)
    discovery.update_home([{
        'url': 'https://emfls.github.io/kor/report/it/test-new-guide.html',
        'title': 'New scheduled guide', 'category': 'it',
        'published': datetime(2026, 11, 8, tzinfo=timezone.utc),
    }])
    updated = page.read_text()
    assert 'New scheduled guide' in updated
    assert source[source.index('    let searchIndex='):] == updated[updated.index('    let searchIndex='):]
