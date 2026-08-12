import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser
ROOT=Path(__file__).resolve().parents[1]; PAGE=ROOT/"game/FlappyDot/index.html"
class FlappyDotPageTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls): cls.html=PAGE.read_text(encoding="utf-8"); cls.page=PageParser(); cls.page.feed(cls.html)
 def test_search(self):
  combined=self.page.title+self.page.h1+self.page.meta["description"]
  for x in ("Flappy Dot","free browser game","Spacebar","mobile"): self.assertIn(x,combined)
  for x in ("No download","2026-08-12","Difficulty increases"): self.assertIn(x,self.html)
 def test_contract(self):
  self.assertEqual(self.page.canonical,"https://emfls.github.io/game/FlappyDot/")
  for x in ("G-QP5Q67GE5B","ca-pub-8830524482034754","function startGame","function flap"): self.assertIn(x,self.html)
  self.assertEqual({x.get("@type") for x in self.page.json_ld},{"VideoGame","FAQPage"}); self.assertIn('div[id^="aswift_"]',self.html)
if __name__=="__main__": unittest.main()
