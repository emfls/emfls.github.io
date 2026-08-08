import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser
ROOT=Path(__file__).resolve().parents[1]; PAGE=ROOT/"kor/report/travel/austria-bruck.html"
class BruckTravelPageTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls): cls.html=PAGE.read_text(encoding="utf-8"); cls.page=PageParser(); cls.page.feed(cls.html)
 def test_intent(self):
  combined=self.page.title+self.page.h1+self.page.meta["description"]
  for x in ("브루크암무어 여행","당일치기","교통","한국 여권"): self.assertIn(x,combined)
  for x in ("코른메서하우스","철의 분수","슐로스베르크"): self.assertIn(x,self.html)
 def test_contract(self):
  self.assertEqual(self.page.canonical,"https://emfls.github.io/kor/report/travel/austria-bruck.html")
  for x in ("G-QP5Q67GE5B","ca-pub-8830524482034754","function filterGuide","function toggleFAQ","2026-08-09"): self.assertIn(x,self.html)
  self.assertEqual({x.get("@type") for x in self.page.json_ld},{"WebPage","FAQPage"}); self.assertIn('div[id^="aswift_"]',self.html)
 def test_sources(self):
  official=[a for a in self.page.links if any(d in a.get("href","") for d in ("tourismus-bruckmur.at","bruckmur.at","steiermark.com","oebb.at","bmeia.gv.at"))]
  self.assertGreaterEqual(len(official),7)
  for x in ("랜드마크 타워","알프스 전망대 케이블카","1 EUR = 1,450원","ETIAS 필수"): self.assertNotIn(x,self.html)
if __name__=="__main__": unittest.main()
