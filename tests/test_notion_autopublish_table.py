"""Regression coverage for Notion native tables and checklist publication."""
from unittest.mock import patch
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import notion_autopublish as publisher


def rich(text, href=None, bold=False):
    return {
        "plain_text": text,
        "href": href,
        "annotations": {"bold": bold},
    }


def table_fixture():
    return {
        "id": "tbl-1",
        "type": "table",
        "has_children": True,
        "table": {
            "table_width": 2,
            "has_column_header": True,
            "has_row_header": False,
        },
    }


def test_native_table_renders_headers_rows_links_and_checkboxes():
    page = [
        {"type": "paragraph", "has_children": False,
         "paragraph": {"rich_text": [rich("Useful introduction.")]}},
        {"type": "heading_2", "has_children": False,
         "heading_2": {"rich_text": [rich("Benefit comparison")]}},
        table_fixture(),
        {"type": "to_do", "has_children": False,
         "to_do": {"rich_text": [rich("Check eligibility")], "checked": False}},
        {"type": "to_do", "has_children": False,
         "to_do": {"rich_text": [rich("Save receipt")], "checked": True}},
    ]
    rows = [
        {"type": "table_row", "has_children": False,
         "table_row": {"cells": [[rich("Amount")], [rich("Evidence")]]}},
        {"type": "table_row", "has_children": False,
         "table_row": {"cells": [[rich("20만원", bold=True)],
                                 [rich("Official source", href="https://www.mois.go.kr/")]]}},
    ]

    def get_blocks(block_id):
        return rows if block_id == "tbl-1" else page

    with patch.object(publisher, "get_blocks", side_effect=get_blocks):
        html, sources, summary = publisher.to_html("page-1")

    assert '<th scope="col">Amount</th>' in html
    assert "<strong>20만원</strong>" in html
    assert '<td><a href="https://www.mois.go.kr/"' in html
    assert "☐ Check eligibility" in html
    assert "☑ Save receipt" in html
    assert html.count("<tr>") == 2
    assert html.index("</table>") < html.index("☐")
    assert sources == ["https://www.mois.go.kr/"]
    assert summary == "Useful introduction."


def test_unexpected_nested_block_still_fails_without_content_loss():
    with patch.object(publisher, "get_blocks", return_value=[
        {"type": "toggle", "has_children": True},
    ]):
        with pytest.raises(ValueError, match="Unsupported nested Notion block"):
            publisher.to_html("page-2")


def test_malformed_table_row_is_rejected_instead_of_truncated():
    bad = {"type": "table_row", "has_children": False,
           "table_row": {"cells": [[rich("missing second cell")]]}}

    def get_blocks(block_id):
        return [bad] if block_id == "tbl-1" else [table_fixture()]

    with patch.object(publisher, "get_blocks", side_effect=get_blocks):
        with pytest.raises(ValueError, match="mismatched cells"):
            publisher.to_html("page-3")
