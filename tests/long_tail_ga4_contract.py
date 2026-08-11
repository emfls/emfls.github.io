import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def assert_manifest(test, pages, marker):
    test.assertEqual(len(pages), 100)
    test.assertEqual(len({row[0] for row in pages}), 100)
    for relative, schema_type, category, hub in pages:
        source = (ROOT / relative).read_text(encoding="utf-8")
        test.assertEqual(source.count(marker), 1, relative)
        test.assertIn('"dateModified":"2026-08-11"', source, relative)
        test.assertIn(f'"@type":"{schema_type}"', source, relative)
        test.assertIn(f'data-trust-category="{category}"', source, relative)
        test.assertIn("max-width:100%", source, relative)
        test.assertIn(f'href="{hub}"', source, relative)
        test.assertIn("G-QP5Q67GE5B", source, relative)
        test.assertIn("ca-pub-8830524482034754", source, relative)
        start = source.index(f"<!-- {marker} -->")
        begin = source.index('<script type="application/ld+json">', start) + len('<script type="application/ld+json">')
        end = source.index("</script>", begin)
        test.assertEqual(json.loads(source[begin:end])["@type"], schema_type, relative)
