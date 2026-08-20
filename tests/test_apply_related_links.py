import unittest

from scripts.apply_related_links import inject_related_section, select_targets


class ApplyRelatedLinksTests(unittest.TestCase):
    def test_inserts_four_unique_links_with_ad_safe_spacing(self):
        html = '<html><body><a href="/existing">Existing</a></body></html>'
        recommendations = [
            {"url": "/existing", "suggested_anchor": "Existing"},
            *({"url": f"/p{i}", "suggested_anchor": f"Page {i}"} for i in range(1, 6)),
        ]
        result = inject_related_section(html, recommendations, "en")
        self.assertEqual(result.count('data-related-reading="seo-pilot"'), 1)
        self.assertEqual(sum(f'href="/p{i}"' in result for i in range(1, 6)), 4)
        self.assertNotIn('href="/existing" data-related-link', result)
        self.assertIn("margin:80px auto", result)
        self.assertNotIn("adsbygoogle", result)

    def test_insertion_is_idempotent(self):
        html = "<html><body></body></html>"
        recs = [{"url": f"/p{i}", "suggested_anchor": str(i)} for i in range(4)]
        once = inject_related_section(html, recs, "ko")
        self.assertEqual(inject_related_section(once, recs, "ko"), once)

    def test_selects_only_pages_with_internal_link_gap(self):
        priorities = [
            {"url": "/a", "reasons": ["few_internal_links"]},
            {"url": "/b", "reasons": ["content_depth_low"]},
            {"url": "/c", "reasons": ["no_internal_links"]},
        ]
        self.assertEqual(select_targets(priorities, count=10), ["/a", "/c"])


if __name__ == "__main__":
    unittest.main()
