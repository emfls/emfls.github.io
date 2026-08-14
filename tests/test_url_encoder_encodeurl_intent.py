import json
import re
from pathlib import Path


PAGE = Path(__file__).resolve().parents[1] / "util/url-encoder/index.html"


def test_encodeurl_query_has_direct_answer():
    html = PAGE.read_text(encoding="utf-8")
    assert "Is encodeURL a JavaScript function?" in html
    assert "There is no standard JavaScript function named <code>encodeURL</code>" in html
    assert "<code>encodeURI</code>" in html
    assert "<code>encodeURIComponent</code>" in html


def test_encodeurl_question_is_in_faq_schema():
    html = PAGE.read_text(encoding="utf-8")
    blocks = re.findall(
        r'<script type="application/ld\+json">(.*?)</script>', html, flags=re.DOTALL
    )
    schemas = [json.loads(block) for block in blocks]
    faq = next(schema for schema in schemas if schema.get("@type") == "FAQPage")
    questions = {item["name"] for item in faq["mainEntity"]}
    assert "Is encodeURL a JavaScript function?" in questions
