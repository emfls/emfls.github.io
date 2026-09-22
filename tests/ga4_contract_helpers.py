import json
import re
from html.parser import HTMLParser


class _PageMetadataParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals = []
        self.json_ld_scripts = []
        self._in_json_ld = False
        self._script_parts = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "link" and "canonical" in attrs.get("rel", "").lower().split():
            self.canonicals.append(attrs.get("href"))
        if tag == "script" and attrs.get("type", "").lower() == "application/ld+json":
            self._in_json_ld = True
            self._script_parts = []

    def handle_data(self, data):
        if self._in_json_ld:
            self._script_parts.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self._in_json_ld:
            self.json_ld_scripts.append("".join(self._script_parts))
            self._in_json_ld = False


def assert_page_json_ld_contract(test, source, relative, expected_type, minimum_date="2026-08-11"):
    parser = _PageMetadataParser()
    parser.feed(source)
    test.assertEqual(len(parser.canonicals), 1, relative)
    test.assertTrue(parser.canonicals[0], relative)
    test.assertTrue(parser.json_ld_scripts, relative)

    payloads = []
    for index, raw_payload in enumerate(parser.json_ld_scripts):
        expected_type_pattern = (
            rf'^\s*\{{\s*(?:"@context"\s*:\s*"[^"]+"\s*,\s*)?'
            rf'"@type"\s*:\s*"{re.escape(expected_type)}"'
        )
        if not re.search(expected_type_pattern, raw_payload):
            continue
        try:
            payload = json.loads(raw_payload)
        except json.JSONDecodeError as exc:
            test.fail(f"invalid {expected_type} JSON-LD script {index + 1} in {relative}: {exc}")
        payloads.extend(payload if isinstance(payload, list) else [payload])

    matching = [
        payload for payload in payloads
        if isinstance(payload, dict)
        and payload.get("@type") == expected_type
        and payload.get("url") == parser.canonicals[0]
    ]
    test.assertTrue(
        matching,
        f"no {expected_type} JSON-LD payload matches canonical {parser.canonicals[0]} in {relative}",
    )
    test.assertTrue(
        any(isinstance(payload.get("dateModified"), str)
            and payload["dateModified"] >= minimum_date for payload in matching),
        f"no {expected_type} JSON-LD payload has dateModified >= {minimum_date} in {relative}",
    )
