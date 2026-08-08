import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser
ROOT=Path(__file__).resolve().parents[1]; PAGE=ROOT/"kor/report/travel/australia-wagga.html"
class WaggaTravelPageTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls): cls.html=PAGE.read_text(encoding="utf-8"); cls.page=PageParser(); cls.page.feed(cls.html)
 def test_intent(self):
  combined=self.page.title+self.page.h1+self.page.meta["description"]
  for x in ("와가와가 여행","2박 3일","기차","ETA"): self.assertIn(x,combined)
  for x in ("Wiradjuri","와가 비치","보타닉 가든"): self.assertIn(x,self.html)
 def test_contract(self):
  self.assertEqual(self.page.canonical,"https://emfls.github.io/kor/report/travel/australia-wagga.html")
  for x in ("G-QP5Q67GE5B","ca-pub-8830524482034754","function filterGuide","function toggleFAQ","2026-08-09"): self.assertIn(x,self.html)
  self.assertEqual({x.get("@type") for x in self.page.json_ld},{"WebPage","FAQPage"}); self.assertIn('div[id^="aswift_"]',self.html)
 def test_sources(self):
  official=[a for a in self.page.links if any(d in a.get("href","") for d in ("visitwagga.com","wagga.nsw.gov.au","transportnsw.info","homeaffairs.gov.au"))]
  self.assertGreaterEqual(len(official),7)
  for x in ("1 AUD = 850원","기차 5시간 고정","무료 와이파이 모든 곳","ETA 24시간 보장"): self.assertNotIn(x,self.html)
if __name__=="__main__": unittest.main()
