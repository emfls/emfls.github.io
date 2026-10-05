import json
import subprocess
import unittest
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
STOCKWIKI = ROOT / "kor/stockwiki"
DIST = STOCKWIKI / "dist"
CANONICAL_ROOT = "https://emfls.github.io/kor/stockwiki/"
EXPECTED_DIST_PAGES = {
    "index.html": f"{CANONICAL_ROOT}",
    **{
        f"stocks/{ticker}/index.html": f"{CANONICAL_ROOT}stocks/{ticker}/"
        for ticker in (
            "000660", "005930", "035420", "035720", "051910",
            "AAPL", "GOOGL", "MSFT", "NVDA", "TSLA",
        )
    },
}
# This existing data fixture is separate from the 11 production routes.
AUXILIARY_BUILD_PAGES = {"test/index.html": f"{CANONICAL_ROOT}test/"}
SITEMAP_PATHS = {url.removeprefix(CANONICAL_ROOT) for url in EXPECTED_DIST_PAGES.values()}
SITEMAP_PATHS.remove("")
SITEMAP_PATHS.add("")


class CanonicalParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag.lower() == "link" and "canonical" in (values.get("rel") or "").lower().split():
            self.canonicals.append(values.get("href"))


class StockWikiBuildIntegrityTest(unittest.TestCase):
    def test_astro_site_uses_canonical_github_pages_host(self):
        config = (STOCKWIKI / "astro.config.mjs").read_text(encoding="utf-8")
        self.assertIn("site: 'https://emfls.github.io'", config)
        self.assertNotIn("emfls.com", config)

    def test_stockwiki_source_and_config_have_no_retired_host(self):
        files = [STOCKWIKI / "astro.config.mjs", *sorted((STOCKWIKI / "src").rglob("*.astro"))]
        offenders = [str(path.relative_to(ROOT)) for path in files if "emfls.com" in path.read_text(encoding="utf-8")]
        self.assertEqual([], offenders)

    def test_manifest_and_lockfile_root_dependencies_match(self):
        manifest = json.loads((STOCKWIKI / "package.json").read_text(encoding="utf-8"))
        lock = json.loads((STOCKWIKI / "package-lock.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["dependencies"], lock["packages"][""]["dependencies"])
        self.assertEqual(manifest.get("devDependencies", {}), lock["packages"][""].get("devDependencies", {}))
        self.assertNotIn("sitemap", manifest["dependencies"])

    def test_build_script_does_not_call_missing_generator(self):
        manifest = json.loads((STOCKWIKI / "package.json").read_text(encoding="utf-8"))
        build_script = manifest["scripts"]["build"]
        self.assertNotIn("gen_sitemap.js", build_script)
        self.assertFalse((STOCKWIKI / "scripts/gen_sitemap.js").exists())

    def test_layout_emits_route_derived_canonical(self):
        layout = (STOCKWIKI / "src/layouts/StockLayout.astro").read_text(encoding="utf-8")
        self.assertRegex(layout, r"<link\s+rel=\"canonical\"")
        self.assertRegex(layout, r"Astro\.site")
        self.assertRegex(layout, r"Astro\.url|Astro\.routePattern")

    @unittest.skipUnless(DIST.exists(), "run npm run build before checking generated StockWiki output")
    def test_fresh_dist_contains_exact_eleven_pages_and_self_canonicals(self):
        failures = []
        for output_path, expected_url in {**EXPECTED_DIST_PAGES, **AUXILIARY_BUILD_PAGES}.items():
            page = DIST / output_path
            if not page.is_file():
                failures.append(f"missing {output_path}")
                continue
            parser = CanonicalParser()
            parser.feed(page.read_text(encoding="utf-8"))
            if parser.canonicals != [expected_url]:
                failures.append(f"{output_path}: expected {[expected_url]!r}, got {parser.canonicals!r}")
            if any("/index.html" in (url or "") or (url or "").startswith("https://emfls.com") for url in parser.canonicals):
                failures.append(f"invalid canonical in {output_path}: {parser.canonicals!r}")

        actual = {path.relative_to(DIST).as_posix() for path in DIST.rglob("*.html") if "pagefind" not in path.parts}
        self.assertEqual([], failures)
        self.assertEqual(set(EXPECTED_DIST_PAGES) | set(AUXILIARY_BUILD_PAGES), actual)
        self.assertEqual(11, len(EXPECTED_DIST_PAGES))

    def test_separately_tracked_sitemap_keeps_eleven_github_io_routes(self):
        sitemap_path = STOCKWIKI / "sitemap.xml"
        root = ElementTree.parse(sitemap_path).getroot()
        namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        urls = [node.text for node in root.findall("sm:url/sm:loc", namespace)]
        expected = {f"{CANONICAL_ROOT}{path}" if path else CANONICAL_ROOT for path in SITEMAP_PATHS}
        self.assertEqual(11, len(urls))
        self.assertEqual(expected, set(urls))
        self.assertTrue(all(url.startswith(CANONICAL_ROOT) for url in urls))

    def test_public_robots_points_to_the_existing_sitemap(self):
        robots = (STOCKWIKI / "public/robots.txt").read_text(encoding="utf-8")
        self.assertIn("Sitemap: https://emfls.github.io/kor/stockwiki/sitemap.xml", robots)
        self.assertNotIn("sitemap-index.xml", robots)
        self.assertTrue((STOCKWIKI / "sitemap.xml").is_file())

    def test_root_build_workflow_is_read_only_and_path_scoped(self):
        workflow_path = ROOT / ".github/workflows/stockwiki-build-qa.yml"
        self.assertTrue(workflow_path.is_file())
        workflow = workflow_path.read_text(encoding="utf-8")
        self.assertRegex(workflow, r"(?m)^  pull_request:\n    paths:")
        self.assertRegex(workflow, r"(?m)^  workflow_dispatch:")
        self.assertNotRegex(workflow, r"(?m)^\s+schedule:")
        self.assertRegex(workflow, r"(?m)^permissions:\n  contents: read$")
        self.assertRegex(workflow, r"(?m)^\s+node-version:\s*['\"]?20")
        for required in ("npm ci", "npm run build", "test_canonical_inventory.py", "test_stockwiki_build_integrity.py", "test_stockwiki_ad_safety.py"):
            self.assertIn(required, workflow)
        self.assertNotRegex(workflow, r"(?im)^\s*run:.*(?:git\s+push|deploy|gh-pages)")

    def test_stockwiki_dist_is_ignored_and_untracked(self):
        ignored = subprocess.run(
            ["git", "check-ignore", "-q", "kor/stockwiki/dist/index.html"],
            cwd=ROOT,
            check=False,
        )
        self.assertEqual(0, ignored.returncode)
        tracked = subprocess.run(
            ["git", "ls-tree", "-r", "--name-only", "HEAD", "--", "kor/stockwiki/dist"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        self.assertEqual("", tracked.stdout.strip())


if __name__ == "__main__":
    unittest.main()
