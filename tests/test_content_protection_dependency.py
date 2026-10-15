import hashlib
import json
import subprocess
import tempfile
import unittest
from collections import Counter
from pathlib import Path

from scripts.content_protection_dependency import (
    build_protection_report,
    load_target_set,
    scan_dependencies,
)
from scripts.ops_paths import ops_path


ROOT = Path(__file__).resolve().parents[1]
REVIEW_SET = ROOT / "tests/fixtures/c01-review-set-50.json"


def write_json(root, relative, payload):
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def write_minimal_protection_sources(root, winner_urls):
    write_json(root, "data/revenue-opportunities.json", {
        "schemaVersion": 1,
        "asOf": "2026-10-10",
        "classificationCounts": {"WINNER": len(winner_urls)},
        "protectedWinners": [{"url": url, "classification": "WINNER"} for url in winner_urls],
    })
    write_json(root, "data/experiments.json", {
        "schema_version": 1,
        "as_of": "2026-09-01",
        "experiments": [{"url": "/jp/report/travel/experiment.html", "status": "INCONCLUSIVE"}],
    })
    write_json(root, "data/content-launch-experiments.json", {
        "schemaVersion": 1,
        "asOf": "2026-09-08",
        "experiments": [{"url": "/jp/report/travel/observing.html", "status": "OBSERVING"}],
    })
    write_json(root, "data/content-launch-decisions.json", {
        "schemaVersion": 1,
        "decisions": [{"keyword": "fixture", "decision": "HOLD", "targetUrl": "/jp/report/travel/hold.html"}],
    })
    write_json(root, "data/content-metadata.json", [
        {"url": "/jp/report/travel/ymyl.html", "ymyl": True},
    ])
    write_json(root, "data/content-launch-queue.json", {
        "schemaVersion": 1,
        "selectedAt": "2026-10-11T15:13:06+09:00",
        "queue": [],
    })
    (root / "data").mkdir(parents=True, exist_ok=True)
    (root / "data/locale-retirement-overrides.json").write_bytes(
        ops_path("data/locale-retirement-overrides.json").read_bytes()
    )
    (root / "scripts").mkdir(parents=True, exist_ok=True)
    for name in ("content_launch_guard.py", "content_launch_policy.py"):
        (root / "scripts" / name).write_bytes((ROOT / "scripts" / name).read_bytes())


def init_tracked_repo(root, files):
    for relative, payload in files.items():
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(payload, bytes):
            path.write_bytes(payload)
        else:
            path.write_text(payload, encoding="utf-8")
    subprocess.run(["git", "init", "-q", str(root)], check=True)
    subprocess.run(["git", "-C", str(root), "add", "--all"], check=True)


class ContentProtectionDependencyTest(unittest.TestCase):
    def test_review_set_is_the_exact_fixed_fifty_route_cohort(self):
        records = load_target_set(REVIEW_SET)
        self.assertEqual(len(records), 50)
        self.assertEqual(len({record["path"] for record in records}), 50)
        self.assertEqual(
            Counter(Path(record["path"]).name.split("-", 1)[0] for record in records),
            Counter({"japan": 17, "italy": 10, "usa": 11, "morocco": 12}),
        )
        self.assertTrue(all(record["historicalBlob"] for record in records))
        self.assertTrue(all(record["historicalBytes"] > 0 for record in records))

    def test_real_repository_protection_sources_fail_closed_on_missingness(self):
        report = build_protection_report(ROOT)
        self.assertEqual(report["status"], "VERIFIED")
        self.assertGreater(report["winners"]["count"], 0)
        self.assertEqual(report["winners"]["duplicateNormalizedCount"], 0)
        self.assertEqual(report["winners"]["invalidOrMissingUrlCount"], 0)
        self.assertGreater(report["experiments"]["observingRouteCount"], 0)
        self.assertGreater(report["decisions"]["holdCount"], 0)
        self.assertGreater(report["ymyl"]["trueCount"], 0)
        self.assertEqual(report["exceptions"]["approvedArabicCount"], 4)
        self.assertFalse(report["deletionAuthorized"])
        revenue_source = report["sources"]["data/revenue-opportunities.json"]
        source_bytes = ops_path("data/revenue-opportunities.json").read_bytes()
        self.assertEqual(revenue_source["sha256"], hashlib.sha256(source_bytes).hexdigest())
        self.assertEqual(revenue_source["bytes"], len(source_bytes))

    def test_duplicate_normalized_winner_routes_make_protection_unknown(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_minimal_protection_sources(
                root,
                [
                    "/jp/report/travel/alpha.html",
                    "https://emfls.github.io/jp/report/travel/alpha.html",
                ],
            )
            report = build_protection_report(root)
            self.assertEqual(report["status"], "UNKNOWN")
            self.assertEqual(report["winners"]["duplicateNormalizedCount"], 1)
            self.assertFalse(report["deletionAuthorized"])

    def test_unmapped_editorial_holds_remain_explicitly_unmapped(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_minimal_protection_sources(root, ["/jp/report/travel/alpha.html"])
            decisions = json.loads((root / "data/content-launch-decisions.json").read_text())
            decisions["decisions"] = [
                {"keyword": "held keyword", "decision": "HOLD"},
                {"keyword": "page review", "decision": "UPDATE_EXISTING", "targetUrl": "/jp/report/travel/alpha.html"},
            ]
            write_json(root, "data/content-launch-decisions.json", decisions)
            report = build_protection_report(root)
            self.assertEqual(report["status"], "VERIFIED")
            self.assertEqual(report["decisions"]["blockedDecisionWithoutTargetUrlCount"], 1)
            self.assertEqual(report["decisions"]["routeMappingStatus"], "PARTIAL")
            self.assertIn("/jp/report/travel/alpha.html", report["routeSets"]["editorialDecisions"])
            self.assertFalse(report["deletionAuthorized"])

    def test_tracked_html_sitemap_js_and_generator_references_are_classified(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            files = {
                "jp/report/travel/alpha.html": (
                    '<link rel="canonical" href="https://emfls.github.io/jp/report/travel/alpha.html">'
                    '<link rel="alternate" hreflang="ja" href="/jp/report/travel/alpha.html">'
                    '<a href="/jp/report/travel/beta.html">Next</a>'
                ),
                "jp/report/travel/beta.html": "<p>Beta page</p>",
                "index.html": '<a href="jp/report/travel/alpha.html">Alpha</a>',
                "jp/report/travel/relative.html": '<a href="beta.html?source=relative">Beta</a>',
                "jp/report/travel/sitemap.xml": (
                    "<urlset><url><loc>https://emfls.github.io/jp/report/travel/alpha.html</loc></url>"
                    "<url><loc>https://emfls.github.io/jp/report/travel/beta.html</loc></url></urlset>"
                ),
                "assets/routes.js": 'const route = "/jp/report/travel/beta.html";',
                "assets/other-route.js": 'const route = "/jp/report/travel/unselected.html";',
                "scripts/generate_jp_routes.py": 'return "/jp/report/travel/" + slug',
                "tests/fixtures/review.json": '{"path":"jp/report/travel/alpha.html"}',
                "TASKS.md": "Historical note: jp/report/travel/alpha.html\n",
                "data/revenue-opportunities.json": '{"protectedWinners":[{"url":"/jp/report/travel/alpha.html"}]}',
                "data/page-performance.json": '{"path":"/jp/report/travel/alpha.html"}',
                "data/cannibalization-report.json": '{"path":"/jp/report/travel/alpha.html"}',
                "search.pf_index": b"\x00\xffpagefind-index",
            }
            init_tracked_repo(root, files)
            targets = [
                {"path": "jp/report/travel/alpha.html"},
                {"path": "jp/report/travel/beta.html"},
            ]
            report = scan_dependencies(root, targets)
            alpha = report["routes"]["jp/report/travel/alpha.html"]
            beta = report["routes"]["jp/report/travel/beta.html"]
            alpha_kinds = {item["kind"] for item in alpha["inboundReferences"]}
            beta_kinds = {item["kind"] for item in beta["inboundReferences"]}
            self.assertIn("internal_html_link", alpha_kinds)
            self.assertIn("sitemap", alpha_kinds)
            self.assertIn("javascript", beta_kinds)
            self.assertIn("sitemap", beta_kinds)
            self.assertIn("jp/report/travel/relative.html", {item["path"] for item in beta["inboundReferences"]})
            self.assertIn("jp/report/travel/beta.html", alpha["outgoingCandidatePaths"])
            self.assertEqual(alpha["analyticalReferenceCount"], 2)
            self.assertNotIn("data/page-performance.json", {item["path"] for item in alpha["inboundReferences"]})
            self.assertEqual(alpha["internalLinkOutboundCount"], 1)
            self.assertEqual(alpha["selfCanonicalCount"], 1)
            self.assertEqual(alpha["selfHreflangCount"], 1)
            self.assertEqual(beta["internalLinkInboundCount"], 2)
            self.assertIn("scripts/generate_jp_routes.py", report["dynamicReferencePaths"])
            self.assertNotIn("assets/other-route.js", report["dynamicReferencePaths"])
            self.assertEqual(alpha["auditReferenceCount"], 1)
            self.assertEqual(alpha["documentationReferenceCount"], 1)
            self.assertNotIn("TASKS.md", {item["path"] for item in alpha["inboundReferences"]})
            self.assertEqual(alpha["policyReferenceCount"], 1)
            self.assertNotIn("data/revenue-opportunities.json", {item["path"] for item in alpha["inboundReferences"]})
            self.assertIn(
                "search.pf_index",
                {item["path"] for item in report["coverage"]["unsupportedPaths"]},
            )
            self.assertEqual(report["coverage"]["status"], "PARTIAL")
            self.assertEqual(report["dynamicReferenceStatus"], "UNKNOWN")
            self.assertEqual(report["deletionAuthorizedCount"], 0)

    def test_no_static_match_with_unreadable_pagefind_remains_unknown(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            init_tracked_repo(root, {
                "jp/report/travel/isolated.html": "<p>No outbound links.</p>",
                "assets/index.pf_index": b"\xff\x00compressed-or-binary-index",
            })
            report = scan_dependencies(root, [{"path": "jp/report/travel/isolated.html"}])
            route = report["routes"]["jp/report/travel/isolated.html"]
            self.assertEqual(route["dependencyStatus"], "UNKNOWN_INCOMPLETE_SCAN")
            self.assertFalse(route["deletionAuthorized"])
            self.assertEqual(report["deletionAuthorizedCount"], 0)


if __name__ == "__main__":
    unittest.main()
