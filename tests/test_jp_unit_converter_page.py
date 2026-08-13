import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser
ROOT=Path(__file__).resolve().parents[1]; PAGE=ROOT/"jp/util/unitconverter/index.html"
class JapaneseUnitConverterPageTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls): cls.html=PAGE.read_text(encoding="utf-8"); cls.page=PageParser(); cls.page.feed(cls.html)
 def test_intent(self):
  combined=self.page.title+self.page.h1+self.page.meta["description"]
  for x in ("単位変換","長さ","重さ","温度"): self.assertIn(x,combined)
  for x in ("速度","体積","面積","2026-08-13"): self.assertIn(x,self.html)
 def test_contract(self):
  self.assertEqual(self.page.canonical,"https://emfls.github.io/jp/util/unitconverter/")
  for x in ("G-QP5Q67GE5B","ca-pub-8830524482034754","function convert","function updateResult"): self.assertIn(x,self.html)
  self.assertEqual({x.get("@type") for x in self.page.json_ld},{"WebApplication","FAQPage"}); self.assertIn('div[id^="aswift_"]',self.html)
 def test_precise_privacy(self): self.assertIn("入力した数値はブラウザ内で計算",self.html); self.assertNotIn("完全にオフライン",self.html)
if __name__=="__main__": unittest.main()
