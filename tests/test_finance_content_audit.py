import unittest

from scripts.finance_content_audit import audit_finance_content


class FinanceContentAuditTests(unittest.TestCase):
    def test_excludes_noindex_archive_from_duplicate_intent_groups(self):
        audit = {"pages": [
            {"url": "/old.html", "path": "kor/report/finance/old.html", "title": "ETF 추천 2025", "indexable": False},
            {"url": "/new.html", "path": "kor/report/finance/new.html", "title": "ETF 추천 2026", "indexable": True},
        ]}

        result = audit_finance_content(audit, [], {})

        self.assertEqual(result["summary"]["finance_pages"], 1)
        self.assertEqual(result["summary"]["duplicate_intent_groups"], 0)
        self.assertEqual(result["pages"][0]["url"], "/new.html")

    def test_selects_finance_pages_and_flags_review_signals_without_claiming_errors(self):
        audit = {
            "pages": [
                {
                    "url": "/kor/report/stock/us-tax.html",
                    "path": "kor/report/stock/us-tax.html",
                    "title": "미국주식 세금 2026",
                    "word_count": 800,
                    "external_links": 0,
                },
                {
                    "url": "/kor/report/travel/seoul.html",
                    "path": "kor/report/travel/seoul.html",
                    "title": "서울 여행",
                    "word_count": 900,
                    "external_links": 2,
                },
                {
                    "url": "/report/travel/djibouti-alisabieh.html",
                    "path": "report/travel/djibouti-alisabieh.html",
                    "title": "Djibouti Alisabieh Travel Guide",
                    "word_count": 900,
                    "external_links": 2,
                },
                {
                    "url": "/kor/report/finance/plain.html",
                    "path": "kor/report/finance/plain.html",
                    "title": "금융 기초 안내",
                    "word_count": 700,
                    "external_links": 1,
                },
                {
                    "url": "/kor/util/password/",
                    "path": "kor/util/password/index.html",
                    "title": "비밀번호 생성기",
                    "word_count": 500,
                    "external_links": 0,
                },
            ]
        }
        metadata = [
            {
                "url": "/kor/report/stock/us-tax.html",
                "sources": [],
                "last_verified": "",
                "opportunity_score": 4.0,
            },
            {
                "url": "/kor/report/finance/plain.html",
                "sources": [{"name": "공식", "url": "https://example.com"}],
                "last_verified": "2026-08-01",
                "opportunity_score": 0,
            },
        ]
        html_by_url = {
            "/kor/report/stock/us-tax.html": "기본공제 250만원, 세율 22%를 적용합니다. SCHD와 VOO 비교",
            "/kor/report/finance/plain.html": "<script>const ETF = 'CSS';</script><style>.USD{}</style><p>기초 안내</p>",
        }

        result = audit_finance_content(audit, metadata, html_by_url)

        self.assertEqual(result["summary"]["finance_pages"], 2)
        pages = {page["url"]: page for page in result["pages"]}
        page = pages["/kor/report/stock/us-tax.html"]
        self.assertEqual(page["url"], "/kor/report/stock/us-tax.html")
        self.assertEqual(page["review_signals"], [
            "missing_curated_sources",
            "missing_last_verified",
            "contains_amount",
            "contains_percentage",
            "contains_ticker",
        ])
        self.assertNotIn("error", page)
        self.assertEqual(pages["/kor/report/finance/plain.html"]["review_signals"], [])

    def test_groups_same_search_intent_and_prioritizes_the_duplicate_candidate(self):
        audit = {
            "pages": [
                {"url": "/a.html", "path": "kor/report/finance/a.html", "title": "미국주식 세금 2026", "word_count": 700, "external_links": 1},
                {"url": "/b.html", "path": "kor/report/stock/b.html", "title": "미국 주식 세금 2025", "word_count": 700, "external_links": 1},
                {"url": "/c.html", "path": "kor/report/stock/c.html", "title": "배당 ETF 비교", "word_count": 700, "external_links": 1},
            ]
        }
        metadata = [
            {"url": "/a.html", "sources": [{"name": "국세청", "url": "https://nts.go.kr"}], "last_verified": "2026-08-01", "opportunity_score": 1},
            {"url": "/b.html", "sources": [], "last_verified": "", "opportunity_score": 2},
            {"url": "/c.html", "sources": [{"name": "공식", "url": "https://example.com"}], "last_verified": "2026-08-01", "opportunity_score": 9},
        ]

        result = audit_finance_content(audit, metadata, {})

        self.assertEqual(result["summary"]["duplicate_intent_groups"], 1)
        self.assertEqual(result["duplicate_intents"][0]["urls"], ["/a.html", "/b.html"])
        pages = {page["url"]: page for page in result["pages"]}
        self.assertIn("duplicate_search_intent", pages["/a.html"]["review_signals"])
        self.assertGreater(pages["/b.html"]["priority_score"], pages["/a.html"]["priority_score"])


if __name__ == "__main__":
    unittest.main()
