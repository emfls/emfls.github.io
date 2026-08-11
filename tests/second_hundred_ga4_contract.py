import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
MARKER = "second-hundred-ga4-priority-2026-08-11"
def assert_batch(test, batch):
    for relative, schema_type, category, hub in batch:
        path = ROOT / relative
        test.assertTrue(path.is_file(), relative)
        source = path.read_text(encoding="utf-8")
        test.assertEqual(source.count(MARKER), 1, relative)
        test.assertIn("\"dateModified\":\"2026-08-11\"", source, relative)
        test.assertIn(f"\"@type\":\"{schema_type}\"", source, relative)
        test.assertIn(f"data-trust-category=\"{category}\"", source, relative)
        test.assertIn("max-width:100%", source, relative)
        test.assertIn(f"href=\"{hub}\"", source, relative)
        test.assertIn("G-QP5Q67GE5B", source, relative)
        test.assertIn("ca-pub-8830524482034754", source, relative)
        start = source.index(f"<!-- {MARKER} -->")
        a = source.index("<script type=\"application/ld+json\">", start) + len("<script type=\"application/ld+json\">")
        b = source.index("</script>", a)
        test.assertEqual(json.loads(source[a:b])["@type"], schema_type, relative)
