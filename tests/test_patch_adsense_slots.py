from pathlib import Path
import importlib
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def module():
    return importlib.import_module("scripts.patch_adsense_slots")


def column():
    return '<head></head><header class="hero"><div>hero</div></header>' + ''.join(
        f'<div class="card"><h2>Section {i}</h2><div><p>Body {i}</p></div></div>' for i in range(1, 5))


def test_nested_third_card_and_hero_boundaries_are_exact():
    m = module()
    result, status = m.patch_column(column())
    assert status == "PATCHED"
    assert '</header>\n<!-- EMFLS_AUTO_ATF_SLOT -->' in result
    assert 'Body 3</p></div></div>\n<!-- EMFLS_AUTO_INARTICLE_SLOT -->' in result
    assert result.index("EMFLS_AUTO_INARTICLE_SLOT") < result.index("Section 4")
    assert 'min-height:280px' in result and 'min-height:250px' in result
    assert 'data-ad-slot="3423411629"' in result
    assert 'data-ad-layout="in-article"' in result


def test_second_run_is_byte_identical_and_partial_marker_is_held():
    m = module()
    first, _ = m.patch_column(column())
    assert m.patch_column(first) == (first, "ALREADY_PATCHED")
    partial = column() + '<!-- EMFLS_AUTO_INARTICLE_SLOT -->'
    assert m.patch_column(partial) == (partial, "PARTIAL_MARKER_HOLD")


def test_missing_or_ambiguous_anchors_never_partially_modify_page():
    m = module()
    for source in ['<header class="hero"></header>', column()+ '<header class="hero"></header>']:
        assert m.patch_column(source) == (source, "ANCHOR_HOLD")


def test_protected_route_and_dry_run_do_not_write(tmp_path):
    m = module()
    d = tmp_path / "kor/column"
    d.mkdir(parents=True)
    p = d / "a.html"
    p.write_text(column())
    report = {"status":"VERIFIED", "routeSets":{"winners":["/kor/column/a.html"]}, "errors":[]}
    rows = m.patch_columns(tmp_path, report, write=True)
    assert rows[0]["status"] == "PROTECTED_HOLD"
    assert p.read_text() == column()
    report["routeSets"]["winners"] = []
    rows = m.patch_columns(tmp_path, report, write=False)
    assert rows[0]["status"] == "PATCHED"
    assert p.read_text() == column()
    report["status"] = "UNKNOWN"
    assert m.patch_columns(tmp_path, report, write=True)[0]["status"] == "PROTECTION_UNKNOWN_HOLD"
    assert p.read_text() == column()


def test_symlink_is_not_followed(tmp_path):
    m = module()
    d = tmp_path / "kor/column"
    d.mkdir(parents=True)
    outside = tmp_path / "original.html"
    outside.write_text(column())
    (d / "alias.html").symlink_to(outside)
    report = {"status":"VERIFIED", "routeSets":{}, "errors":[]}
    assert m.patch_columns(tmp_path, report, write=True)[0]["status"] == "SYMLINK_HOLD"
    assert outside.read_text() == column()


def test_future_template_hero_and_third_nonempty_section():
    from build_column_page import build_html, sections_to_html
    sections = [{"heading":"", "body":[]}] + [{"heading":f"Section {i}","body":["Body content long enough for a description."]} for i in range(1,5)]
    body = sections_to_html(sections)
    assert body.count("EMFLS_AUTO_INARTICLE_SLOT") == 1
    assert body.index("Section 3") < body.index("EMFLS_AUTO_INARTICLE_SLOT") < body.index("Section 4")
    html = build_html("Test",body,"test","content")
    assert html.index("</header>") < html.index("EMFLS_AUTO_ATF_SLOT") < html.index('class="intro-box"')


def test_new_slot_has_clear_label_and_no_click_or_refresh_tracking():
    m = module()
    code = m.ad_slot("EMFLS_AUTO_ATF_SLOT",280)
    assert 'aria-label="Advertisement"' in code and '>Advertisement<' in code
    assert 'setInterval' not in code and 'onclick' not in code and 'overflow:hidden' not in code


def test_atomic_failure_preserves_original(tmp_path, monkeypatch):
    import pytest
    m = module()
    d = tmp_path / 'kor/column'
    d.mkdir(parents=True)
    p = d / 'a.html'
    p.write_text(column())
    def fail_replace(*args):
        raise OSError('fixture failure before replacement')
    monkeypatch.setattr(m.os, 'replace', fail_replace)
    report = {'status':'VERIFIED', 'routeSets':{}, 'errors':[]}
    with pytest.raises(OSError):
        m.patch_columns(tmp_path,report,write=True)
    assert p.read_text() == column()
    assert not list(d.glob('.adsense-*'))


def test_feed_uses_real_native_code_after_cards_three_and_seven():
    m = module()
    source = '<div class="items-grid">' + ''.join(f'<div class="item-card"><p>Place {i}</p></div>' for i in range(1,11)) + '</div>'
    result, status = m.patch_feed(source)
    assert status == 'PATCHED'
    assert 'Place 3</p></div>\n<!-- EMFLS_AUTO_FEED_3 -->' in result
    assert 'Place 7</p></div>\n<!-- EMFLS_AUTO_FEED_7 -->' in result
    assert result.count('data-ad-slot="5441320677"') == 2
    assert result.count('data-ad-layout-key="-6u+cw+56-h-7x"') == 2
    assert result.count('class="item-card"') == 10
    assert '추천 안내' not in result
    assert m.patch_feed(result) == (result, 'ALREADY_PATCHED')
    short = '<div class="item-card">one</div>'
    assert m.patch_feed(short) == (short, 'ANCHOR_HOLD')


def test_patch_protection_includes_immutable_pin_and_fails_closed(tmp_path, monkeypatch):
    import scripts.content_protection_dependency as dependency
    import scripts.content_launch_guard as guard
    m = module()
    monkeypatch.setattr(dependency, 'build_protection_report', lambda *args: {'status':'VERIFIED','errors':[], 'routeSets':{'winners':[]}})
    assert m.build_patch_protection(tmp_path,tmp_path)['status'] == 'UNKNOWN'
    (tmp_path/'state').mkdir()
    (tmp_path/'state/content-launch-guard-base-ref.txt').write_text('a'*40)
    snapshot = {'revision':'a'*40,'json':{'data/revenue-opportunities.json':{'protectedWinners':[{'url':'/kor/column/historic-winner.html'}]},'data/experiments.json':{'experiments':[{'url':'/kor/column/observing.html','status':'OBSERVING'}]}}}
    monkeypatch.setattr(guard, '_trusted_base_snapshot', lambda *args: snapshot)
    report = m.build_patch_protection(tmp_path,tmp_path)
    assert report['status']=='VERIFIED'
    assert set(report['routeSets']['trustedSnapshot']) == {'/kor/column/historic-winner.html','/kor/column/observing.html'}


def test_incomplete_or_duplicate_marker_pairs_are_never_success():
    m = module()
    for markers in [('EMFLS_AUTO_ATF_SLOT',),('EMFLS_AUTO_INARTICLE_SLOT',),('EMFLS_AUTO_ATF_SLOT','EMFLS_AUTO_ATF_SLOT','EMFLS_AUTO_INARTICLE_SLOT')]:
        source = column() + ''.join(f'<!-- {x} -->' for x in markers)
        assert m.patch_column(source) == (source,'PARTIAL_MARKER_HOLD')
    for markers in [('EMFLS_AUTO_FEED_3',),('EMFLS_AUTO_FEED_7',),('EMFLS_AUTO_FEED_3','EMFLS_AUTO_FEED_3','EMFLS_AUTO_FEED_7')]:
        source = ''.join(f'<!-- {x} -->' for x in markers)
        assert m.patch_feed(source) == (source,'PARTIAL_MARKER_HOLD')
