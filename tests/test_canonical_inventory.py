from html.parser import HTMLParser
from pathlib import Path
import unicodedata


ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "https://emfls.github.io"
EXCLUDED = {
    "404.html",
    "google3cba66fc0d0e3d2e.html",
    "naverea2d4af329724872f8cfdad857e3540e.html",
    "kor/stockwiki/test/index.html",
}


class CanonicalParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "link":
            return
        values = {name.lower(): value for name, value in attrs}
        rel = (values.get("rel") or "").lower().split()
        if "canonical" in rel and values.get("href"):
            self.urls.append(values["href"])


def public_url(relative_path: str) -> str:
    relative_path = unicodedata.normalize("NFC", relative_path)
    if relative_path == "index.html":
        return f"{BASE_URL}/"
    if relative_path.endswith("/index.html"):
        return f"{BASE_URL}/{relative_path[:-10]}"
    return f"{BASE_URL}/{relative_path}"


def test_every_indexable_html_has_one_exact_self_canonical():
    failures = []
    for page in sorted(ROOT.rglob("*.html")):
        relative_path = unicodedata.normalize("NFC", page.relative_to(ROOT).as_posix())
        if relative_path in EXCLUDED:
            continue

        parser = CanonicalParser()
        parser.feed(page.read_text(encoding="utf-8"))
        expected = public_url(relative_path)
        if parser.urls != [expected]:
            failures.append(f"{relative_path}: expected {[expected]!r}, got {parser.urls!r}")

    assert not failures, "\n" + "\n".join(failures)


def test_no_canonical_uses_retired_custom_domain():
    offenders = []
    for page in sorted(ROOT.rglob("*.html")):
        parser = CanonicalParser()
        parser.feed(page.read_text(encoding="utf-8"))
        if any(url.startswith("https://emfls.com") for url in parser.urls):
            offenders.append(page.relative_to(ROOT).as_posix())

    assert not offenders, offenders
