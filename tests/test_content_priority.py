import unittest

from scripts.score_content_priority import quality_score, rank_candidates


class ContentPriorityTests(unittest.TestCase):
    def test_complete_page_scores_higher_than_thin_page_and_explains_gaps(self):
        complete = self.page(word_count=1800, internal_links=8, external_links=2, structured_data_types=["Article"])
        thin = self.page(title="", description="", canonical="", h1_count=0, word_count=100, internal_links=0)
        metadata = self.metadata(sources=[{"name": "Official", "url": "https://example.com"}], last_verified="2026-08-01")
        good = quality_score(complete, metadata, as_of="2026-08-20")
        bad = quality_score(thin, self.metadata(), as_of="2026-08-20")
        self.assertGreater(good["score"], bad["score"])
        self.assertIn("missing_title", bad["reasons"])
        self.assertIn("thin_content", bad["reasons"])

    def test_priority_combines_opportunity_with_quality_gap(self):
        audit = {"pages": [self.page(url="/a"), self.page(url="/b", word_count=1800, internal_links=8)]}
        metadata = [self.metadata(url="/a", opportunity_score=5), self.metadata(url="/b", opportunity_score=1)]
        performance = {"pages": [
            {"url": "/a", "impressions": 1000, "opportunity_score": 5},
            {"url": "/b", "impressions": 100, "opportunity_score": 1},
        ]}
        ranked = rank_candidates(audit, metadata, performance, as_of="2026-08-20")
        self.assertEqual([row["url"] for row in ranked], ["/a", "/b"])
        self.assertGreater(ranked[0]["priority_score"], ranked[1]["priority_score"])

    @staticmethod
    def page(url="/a", **changes):
        value = {"url": url, "title": "Title", "description": "Description", "canonical": "https://emfls.github.io/a", "h1_count": 1, "word_count": 400, "internal_links": 1, "external_links": 0, "structured_data_types": [], "updated_date": ""}
        value.update(changes)
        return value

    @staticmethod
    def metadata(url="/a", **changes):
        value = {"url": url, "sources": [], "last_verified": "", "updated": "", "ymyl": False, "opportunity_score": 1}
        value.update(changes)
        return value


if __name__ == "__main__":
    unittest.main()
