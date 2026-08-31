import unittest

from scripts.quality_scoring import classify_page, evidence, grade_for, score_page, status_for


def finance_page():
    return {
        "path": "stockwiki/abc.html",
        "url": "/stockwiki/abc.html",
        "title": "ABC Stock Analysis",
        "description": "ABC valuation and risk analysis.",
        "category": "stockwiki",
        "word_count": 1200,
        "h1_count": 1,
        "h2_count": 5,
        "internal_links": 5,
        "external_links": 0,
        "images": 0,
        "structured_data_types": ["Article"],
        "canonical": "https://emfls.github.io/stockwiki/abc.html",
        "indexable": True,
        "adsense": True,
        "has_viewport": True,
        "has_table": True,
        "has_form": False,
        "has_breadcrumb": True,
        "has_related_section": True,
        "has_author_signal": True,
        "has_method_signal": True,
        "has_limitation_signal": True,
        "interactive_controls": 0,
        "visible_text_prefix": "ABC valuation uses 2026 revenue data and explains risk.",
        "image_alt_missing": 0,
    }


def trust_page():
    page = finance_page()
    page.update({
        "path": "privacy.html",
        "url": "/privacy.html",
        "title": "Privacy Policy",
        "category": "root",
        "word_count": 650,
        "internal_links": 1,
        "has_related_section": False,
    })
    return page


def scoring_context(**overrides):
    context = {
        "sitemap_urls": {"/stockwiki/abc.html", "/privacy.html"},
        "broken_link_sources": set(),
        "duplicate_title_urls": set(),
        "duplicate_description_urls": set(),
        "duplicate_canonical_urls": set(),
        "severe_duplicate_urls": set(),
        "inbound_links": {"/stockwiki/abc.html": 3, "/privacy.html": 1},
        "duplicate_body_candidate": False,
        "ad_ux_warning_urls": set(),
    }
    context.update(overrides)
    return context


class QualityEvidenceModelTest(unittest.TestCase):
    def test_classifies_page_types_without_treating_privacy_as_traffic(self):
        self.assertEqual(
            classify_page({"path": "privacy.html", "category": "root", "structured_data_types": []}, {}),
            "TRUST",
        )
        self.assertEqual(
            classify_page(
                {
                    "path": "util/roi-calculator/index.html",
                    "category": "util",
                    "structured_data_types": ["WebApplication"],
                },
                {},
            ),
            "TOOL",
        )
        self.assertEqual(
            classify_page(
                {
                    "path": "kor/report/camp/namyangju.html",
                    "category": "report",
                    "structured_data_types": ["Article"],
                },
                {},
            ),
            "TRAFFIC",
        )
        self.assertEqual(
            classify_page({"path": "stockwiki/abc.html", "category": "stockwiki", "structured_data_types": []}, {}),
            "MONEY",
        )

    def test_explicit_valid_page_type_wins_and_invalid_type_is_rejected(self):
        page = {"path": "report/example.html", "category": "report", "structured_data_types": []}
        self.assertEqual(classify_page(page, {"page_type": "HUB"}), "HUB")
        with self.assertRaisesRegex(ValueError, "invalid page type"):
            classify_page(page, {"page_type": "BLOG"})

    def test_grade_and_status_boundaries_are_exact(self):
        actual = [(grade_for(value), status_for(value)) for value in (49, 50, 59, 60, 69, 70, 79, 80, 89, 90)]
        self.assertEqual(
            actual,
            [
                ("F", "FAIL"),
                ("D", "FAIL"),
                ("D", "FAIL"),
                ("C", "NEEDS_WORK"),
                ("C", "NEEDS_WORK"),
                ("B", "PUBLISHABLE"),
                ("B", "PUBLISHABLE"),
                ("A", "GOOD"),
                ("A", "GOOD"),
                ("S", "CORE"),
            ],
        )

    def test_evidence_rejects_unknown_status(self):
        self.assertEqual(
            evidence(True, "VERIFIED", ["canonical_present"]),
            {"value": True, "status": "VERIFIED", "reasons": ["canonical_present"]},
        )
        with self.assertRaisesRegex(ValueError, "invalid evidence status"):
            evidence(True, "ASSUMED")

    def test_finance_without_sources_gets_verified_55_cap(self):
        result = score_page(finance_page(), {}, scoring_context())
        self.assertGreaterEqual(result["raw_score"], result["score"])
        self.assertLessEqual(result["score"], 55)
        self.assertEqual({cap["code"] for cap in result["caps"]}, {"finance_without_sources"})
        self.assertEqual(result["caps"][0]["status"], "VERIFIED")
        self.assertEqual(sum(item["score"] for item in result["scores"].values()), result["raw_score"])

    def test_manual_duplicate_suspicion_is_not_silently_applied(self):
        page = finance_page()
        metadata = {"sources": [{"name": "SEC", "url": "https://www.sec.gov/"}]}
        result = score_page(page, metadata, scoring_context(duplicate_body_candidate=True))
        self.assertEqual(result["caps"], [])
        self.assertEqual(result["cap_candidates"][0]["status"], "MANUAL_REVIEW_REQUIRED")
        self.assertEqual(result["cap_candidates"][0]["code"], "possible_ai_or_template_copy")

    def test_trust_page_does_not_require_three_related_articles(self):
        result = score_page(trust_page(), {}, scoring_context())
        self.assertNotIn("fewer_than_three_related_pages", result["issues"])

    def test_non_financial_tool_does_not_require_external_editorial_sources(self):
        page = finance_page()
        page.update({
            "path": "util/percentage-calculator/index.html",
            "url": "/util/percentage-calculator/",
            "category": "util",
            "structured_data_types": ["WebApplication"],
            "has_form": True,
        })
        result = score_page(page, {}, scoring_context())
        self.assertEqual(result["type"], "TOOL")
        self.assertNotIn("missing_sources", result["issues"])

    def test_score_contains_exact_eight_categories_and_actionable_recommendations(self):
        result = score_page(finance_page(), {}, scoring_context())
        self.assertEqual(
            set(result["scores"]),
            {"searchIntent", "contentValue", "seo", "trust", "ux", "internalLinks", "monetization", "technical"},
        )
        self.assertTrue(any("source" in recommendation.lower() for recommendation in result["recommendations"]))


if __name__ == "__main__":
    unittest.main()
