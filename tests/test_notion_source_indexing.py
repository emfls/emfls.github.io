"""Published Notion articles must remain indexable while the raw source template is not."""
import unittest

from scripts.notion_article_template import TEMPLATE, render_article


class NotionSourceIndexingTests(unittest.TestCase):
    def test_raw_source_is_noindex_but_rendered_articles_remain_indexable(self):
        raw = TEMPLATE.read_text(encoding="utf-8")
        self.assertEqual(
            raw.count('<meta name="robots" content="noindex,nofollow">'),
            1,
        )
        self.assertNotIn(
            '<meta name="robots" content="index,follow,max-image-preview:large">',
            raw,
        )

        article = render_article(
            title="검증용 글",
            description="원본 템플릿과 발행 결과를 구별합니다.",
            url="https://emfls.github.io/kor/report/it/fixture-test.html",
            category="it",
            body="<h2>검증 단계</h2><p>실제 발행된 기사는 색인 허용입니다.</p>",
            published_date="2026-11-10",
        )
        self.assertEqual(
            article.count(
                '<meta name="robots" content="index,follow,max-image-preview:large">'
            ),
            1,
        )
        self.assertNotIn("noindex,nofollow", article)
        self.assertEqual(article.count("ca-pub-8830524482034754"), 1)
        self.assertNotIn("{{CATEGORY_HREF}}", article)


if __name__ == "__main__":
    unittest.main()
