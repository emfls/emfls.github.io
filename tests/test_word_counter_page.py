import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser
ROOT=Path(__file__).resolve().parents[1]; PAGE=ROOT/"util/EasyLetterWordCounter/index.html"
class WordCounterPageTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls): cls.html=PAGE.read_text(encoding="utf-8"); cls.page=PageParser(); cls.page.feed(cls.html)
 def test_intent_and_results(self):
  combined=cls_text=self.page.title+self.page.h1+self.page.meta["description"]
  for x in ("Word Counter","Character Counter","privacy"): self.assertIn(x,combined)
  for x in ("Characters (with spaces)","Characters (no spaces)","Words","Sentences","Paragraphs"): self.assertIn(x,self.html)
 def test_contract(self):
  self.assertEqual(self.page.canonical,"https://emfls.github.io/util/EasyLetterWordCounter/")
  for x in ("G-QP5Q67GE5B","ca-pub-8830524482034754","function updateCounts","2026-08-09"): self.assertIn(x,self.html)
  self.assertEqual({x.get("@type") for x in self.page.json_ld},{"WebApplication","FAQPage"}); self.assertIn('div[id^="aswift_"]',self.html)
 def test_privacy_is_precise(self):
  self.assertIn("Your typed text is processed locally",self.html); self.assertIn("analytics and advertising scripts",self.html)
  self.assertNotIn("Nothing is sent or stored anywhere",self.html)
if __name__=="__main__": unittest.main()
