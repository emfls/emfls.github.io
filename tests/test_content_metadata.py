import unittest

from scripts.validate_content_metadata import build_metadata, validate_metadata


class ContentMetadataTests(unittest.TestCase):
    def test_builds_sidecar_only_for_striking_distance_pages(self):
        audit = {"pages": [
            {"url": "/a", "title": "ETF 세금 가이드", "category": "report", "published_date": "2026-01-01", "updated_date": "2026-02-01"},
            {"url": "/b", "title": "일반 글", "category": "report", "published_date": "", "updated_date": ""},
        ]}
        performance = {"pages": [
            {"url": "/a", "striking_distance": True, "opportunity_score": 3},
            {"url": "/b", "striking_distance": False, "opportunity_score": 1},
        ]}
        entries = build_metadata(audit, performance)
        self.assertEqual([entry["url"] for entry in entries], ["/a"])
        self.assertEqual(entries[0]["intent"], "informational")
        self.assertTrue(entries[0]["ymyl"])

    def test_duplicate_urls_are_rejected(self):
        entry = self.valid_entry()
        errors = validate_metadata([entry, dict(entry)], {"/a"})
        self.assertIn("duplicate_url:/a", errors)

    def test_directory_and_index_variants_resolve_to_audit_url(self):
        audit = {"pages": [{"url": "/game/A/", "title": "A", "category": "game", "published_date": "", "updated_date": ""}]}
        performance = {"pages": [{"url": "/game/A/index.html", "striking_distance": True, "opportunity_score": 1}]}
        entries = build_metadata(audit, performance)
        self.assertEqual(entries[0]["url"], "/game/A/")

    def test_url_variants_collapse_to_one_entry_with_highest_score(self):
        audit = {"pages": [{"url": "/game/A/", "title": "A", "category": "game", "published_date": "", "updated_date": ""}]}
        performance = {"pages": [
            {"url": "/game/A", "striking_distance": True, "opportunity_score": 1},
            {"url": "/game/A/", "striking_distance": True, "opportunity_score": 2},
        ]}
        entries = build_metadata(audit, performance)
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["opportunity_score"], 2)

    def test_ymyl_requires_sources_and_last_verified(self):
        entry = self.valid_entry()
        entry.update({"ymyl": True, "sources": [], "last_verified": ""})
        errors = validate_metadata([entry], {"/a"})
        self.assertIn("ymyl_missing_sources:/a", errors)
        self.assertIn("ymyl_missing_last_verified:/a", errors)

    def test_unknown_url_is_rejected(self):
        errors = validate_metadata([self.valid_entry()], {"/other"})
        self.assertIn("unknown_url:/a", errors)

    @staticmethod
    def valid_entry():
        return {
            "url": "/a", "topics": ["test"], "target_query": "test",
            "intent": "informational", "sources": [], "published": "2026-01-01",
            "updated": "2026-02-01", "last_verified": "", "review_interval": 365,
            "related": [], "content_value": 1.0, "ymyl": False,
        }


if __name__ == "__main__":
    unittest.main()
