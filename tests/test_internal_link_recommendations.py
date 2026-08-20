import unittest

from scripts.recommend_internal_links import recommend_links


class InternalLinkRecommendationTests(unittest.TestCase):
    def test_excludes_self_existing_and_other_languages(self):
        pages = [self.page("/kor/report/visa/a.html", "한국 비자 안내", "ko")]
        pages += [self.page(f"/kor/report/visa/{name}.html", f"{name} 비자 안내", "ko") for name in "bcdefg"]
        pages.append(self.page("/jp/report/visa/j.html", "日本 ビザ", "ja"))
        metadata = [{"url": "/kor/report/visa/a.html", "topics": ["visa"]}]
        result = recommend_links(
            {"pages": pages}, metadata,
            existing_targets={"/kor/report/visa/a.html": {"/kor/report/visa/b.html"}},
            limit=4,
        )
        urls = [item["url"] for item in result[0]["recommendations"]]
        self.assertEqual(len(urls), 4)
        self.assertNotIn("/kor/report/visa/a.html", urls)
        self.assertNotIn("/kor/report/visa/b.html", urls)
        self.assertNotIn("/jp/report/visa/j.html", urls)

    def test_topic_match_scores_above_category_only(self):
        pages = [
            self.page("/kor/report/visa/a.html", "해외 비자 안내", "ko"),
            self.page("/kor/report/visa/b.html", "해외 비자 준비", "ko"),
            self.page("/kor/report/visa/c.html", "여행 준비 목록", "ko"),
        ]
        metadata = [
            {"url": "/kor/report/visa/a.html", "topics": ["visa"]},
            {"url": "/kor/report/visa/b.html", "topics": ["visa"]},
        ]
        result = recommend_links({"pages": pages}, metadata, limit=2)
        self.assertEqual(result[0]["recommendations"][0]["url"], "/kor/report/visa/b.html")
        self.assertIn("same_topic", result[0]["recommendations"][0]["reasons"])

    def test_root_navigation_page_is_not_treated_as_content_source(self):
        root = self.page("/", "Home", "ko")
        root["category"] = "root"
        result = recommend_links({"pages": [root]}, [{"url": "/", "topics": ["root"]}])
        self.assertEqual(result, [])

    @staticmethod
    def page(url, title, language):
        return {
            "url": url, "path": url.lstrip("/"), "title": title,
            "language": language, "category": "report", "indexable": True,
            "word_count": 800, "updated_date": "2026-07-01",
        }


if __name__ == "__main__":
    unittest.main()
