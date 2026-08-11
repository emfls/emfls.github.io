from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def assert_batch(test,batch):
 for relative,schema,category,hub in batch:
  with test.subTest(relative=relative):
   html=(ROOT/relative).read_text(encoding="utf-8"); compact="".join(html.split())
   test.assertIn("ga4-priority-2026-08-11",html); test.assertIn("2026-08-11",html)
   test.assertIn(f'"@type":"{schema}"',compact); test.assertIn(f'data-trust-category="{category}"',html)
   test.assertIn("max-width:100%",compact); test.assertIn(hub,html)
   test.assertIn("G-QP5Q67GE5B",html); test.assertIn("ca-pub-8830524482034754",html)
