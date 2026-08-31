import unittest

from scripts.quality_scoring import classify_page, evidence, grade_for, status_for


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


if __name__ == "__main__":
    unittest.main()
