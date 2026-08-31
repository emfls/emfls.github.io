import unittest

from scripts.quality_reports import render_dashboard, render_site_markdown


def site_fixture():
    return {
        "score": 74,
        "grade": "B",
        "as_of": "2026-08-31",
        "scores": {
            "contentPortfolio": {"score": 15, "max": 25},
            "searchAcquisition": {"score": 14, "max": 20},
            "siteStructure": {"score": 10, "max": 15},
            "technicalHealth": {"score": 13, "max": 15},
            "trust": {"score": 7, "max": 10},
            "monetization": {"score": 15, "max": 15},
        },
        "kpis": {
            "total_pages": 2,
            "grades": {"S": 0, "A": 1, "B": 0, "C": 0, "D": 1, "F": 0},
            "average_page_score": 70,
            "median_page_score": 70,
            "pages_80_plus_ratio": 0.5,
            "pages_under_60_ratio": 0.5,
            "targets": {"site_score": 90, "pages_80_plus_ratio": 0.8, "pages_under_60_ratio": 0.03},
        },
        "connections": {"gsc": "CSV_CONNECTED", "ga4": "CSV_CONNECTED", "url_adsense": "NOT_CONNECTED"},
        "revenue_goal": {"status": "DATA NOT AVAILABLE"},
    }


def page_results():
    return [
        {
            "url": "/good/",
            "score": 85,
            "grade": "A",
            "type": "TOOL",
            "status": "GOOD",
            "issues": ["missing_sources"],
            "recommendations": ["Add a primary source link."],
            "priority": {"score": 70, "level": "HIGH", "basis": "MEASURED"},
        },
        {
            "url": "/weak/",
            "score": 55,
            "grade": "D",
            "type": "TRAFFIC",
            "status": "FAIL",
            "issues": ["thin_content"],
            "recommendations": ["Add a direct answer and examples."],
            "priority": {"score": 40, "level": "MEDIUM", "basis": "ESTIMATED"},
        },
    ]


class QualityReportTest(unittest.TestCase):
    def test_markdown_contains_required_decision_sections(self):
        text = render_site_markdown(site_fixture(), page_results(), None)
        for heading in ("현재 SITE SCORE", "가장 큰 사이트 문제", "가장 먼저 개선할 페이지", "데이터 제한", "다음 작업"):
            self.assertIn(heading, text)

    def test_markdown_labels_historical_adsense_period(self):
        site = site_fixture()
        site["revenue_goal"] = {
            "status": "VERIFIED",
            "label": "historical_period_daily_average",
            "period": {"start": "2023-08-01", "end": "2026-08-01", "days": 1097},
            "daily_revenue_usd": 0.08,
            "achievement_rate": 0.0008,
            "required_growth": 1250,
            "required_page_views": 95238,
        }
        text = render_site_markdown(site, page_results(), None)
        self.assertIn("과거 데이터 기간", text)
        self.assertIn("2023-08-01 ~ 2026-08-01", text)

    def test_dashboard_has_filters_but_no_account_or_ad_interaction_code(self):
        html = render_dashboard(site_fixture(), page_results())
        self.assertIn('id="grade-filter"', html)
        self.assertIn('id="type-filter"', html)
        self.assertNotIn("ca-pub-", html)
        self.assertNotIn("adsbygoogle", html)
        self.assertNotIn("ad_click", html)
        self.assertIn("100 rows", html)


if __name__ == "__main__":
    unittest.main()
