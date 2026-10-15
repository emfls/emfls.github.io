from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANUAL_ONLY = (
    "keyword-hunter.yml",
    "content-index-refresh.yml",
    "stockwiki-build-qa.yml",
    "seo-qa.yml",
    "ga4-collection.yml",
    "gsc-collection.yml",
    "derived-measurement-publisher.yml",
)


def test_operations_moved_to_local_execution_are_manual_only():
    for name in MANUAL_ONLY:
        workflow = (ROOT / ".github/workflows" / name).read_text(encoding="utf-8")
        trigger_block = workflow.split("permissions:", 1)[0]
        assert "workflow_dispatch:" in trigger_block, name
        for automated_trigger in ("schedule:", "push:", "pull_request:"):
            assert automated_trigger not in trigger_block, (name, automated_trigger)


def test_partial_adsense_collection_and_indexnow_push_trigger_are_preserved():
    adsense = (ROOT / ".github/workflows/adsense-collection.yml").read_text(encoding="utf-8")
    assert "workflow_dispatch:" in adsense.split("permissions:", 1)[0]
    assert 'cron: "47 1 * * *"' in adsense

    indexnow = (ROOT / ".github/workflows/indexnow-submit.yml").read_text(encoding="utf-8")
    trigger_block = indexnow.split("permissions:", 1)[0]
    assert "push:" in trigger_block
    assert "workflow_dispatch:" in trigger_block
