from pathlib import Path
import importlib.util


SCRIPT = Path(__file__).parents[1] / "scripts" / "remove_sensitive_page_ads.py"
spec = importlib.util.spec_from_file_location("remove_sensitive_page_ads", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_sensitive_paths_are_narrowly_selected():
    assert module.is_sensitive_path(Path("game/PONG/index.html"))
    assert module.is_sensitive_path(Path("jp/game/index.html"))
    assert module.is_sensitive_path(Path("kor/privacy-policy.html"))
    assert module.is_sensitive_path(Path("kor/terms.html"))
    assert module.is_sensitive_path(Path("kor/contact.html"))
    assert not module.is_sensitive_path(Path("kor/report/travel/game-reserve.html"))
    assert not module.is_sensitive_path(Path("kor/index.html"))


def test_adsense_is_removed_but_ga4_and_game_logic_are_preserved():
    html = '''<head>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-x" crossorigin="anonymous"></script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-TEST"></script>
</head><body><button id="play">Play</button>
<div class="ad-wrap"><ins class="adsbygoogle" data-ad-client="ca-pub-x"></ins></div>
<script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
<script>document.querySelector('#play').onclick=()=>startGame();</script></body>'''
    result = module.remove_adsense(html)
    assert "pagead2.googlesyndication.com" not in result
    assert "adsbygoogle" not in result
    assert "googletagmanager.com/gtag" in result
    assert "startGame()" in result
    assert '<div class="ad-wrap"></div>' not in result


def test_removal_is_idempotent():
    html = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=x"></script><main>Keep</main>'
    once = module.remove_adsense(html)
    assert module.remove_adsense(once) == once


def test_adsense_only_css_rule_is_removed_from_a_shared_style_block():
    html = '<style>.game{display:block} ins.adsbygoogle,div[id^="aswift_"]{max-width:100%;overflow:hidden} .score{color:red}</style>'
    result = module.remove_adsense(html)
    assert "adsbygoogle" not in result
    assert ".game{display:block}" in result
    assert 'div[id^="aswift_"]' in result
    assert ".score{color:red}" in result


def test_alternate_adsense_loader_path_is_removed():
    html = '<script async src="https://pagead2.googlesyndication.com/pagead/js?client=ca-pub-x" crossorigin="anonymous"></script>'
    assert "googlesyndication" not in module.remove_adsense(html)


def test_css_cleanup_never_crosses_html_tag_boundaries():
    html = '<script>function game(){return {score: 1};}</script><style>ins.adsbygoogle{max-width:100%}.score{color:red}</style><link rel="canonical" href="https://example.com/game/">'
    result = module.remove_adsense(html)
    assert "</script><style>" in result
    assert "function game()" in result
    assert ".score{color:red}" in result
    assert 'rel="canonical"' in result


def test_disabled_marker_is_non_executable_and_idempotent():
    html = "<html><head><title>Game</title></head><body></body></html>"
    once = module.ensure_disabled_marker(html)
    assert "AdSense disabled" in once
    assert "ca-pub-8830524482034754" in once
    assert "pagead2.googlesyndication.com" not in once
    assert "adsbygoogle" not in once
    assert 'div[id^="aswift_"]{max-width:100%' in once
    assert module.ensure_disabled_marker(once) == once
