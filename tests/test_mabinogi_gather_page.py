import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser
ROOT=Path(__file__).resolve().parents[1]; PAGE=ROOT/"kor/report/mabinogi-auto-gather-guide.html"
class MabinogiGatherPageTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls): cls.html=PAGE.read_text(encoding="utf-8"); cls.page=PageParser(); cls.page.feed(cls.html)
 def test_intent(self):
  combined=self.page.title+self.page.h1+self.page.meta["description"]
  for x in ("마비노기 모바일 채집","가까운 위치 찾기","생활도구","공식"): self.assertIn(x,combined)
  for x in ("비인가 프로그램","영구 게임 이용제한","구하는 방법"): self.assertIn(x,self.html)
 def test_contract(self):
  self.assertEqual(self.page.canonical,"https://emfls.github.io/kor/report/mabinogi-auto-gather-guide.html")
  for x in ("G-QP5Q67GE5B","ca-pub-8830524482034754","function filterGuide","function toggleFAQ","2026-08-09"): self.assertIn(x,self.html)
  self.assertEqual({x.get("@type") for x in self.page.json_ld},{"WebPage","FAQPage"}); self.assertIn('div[id^="aswift_"]',self.html)
 def test_sources_and_removal(self):
  official=[a for a in self.page.links if "mabinogimobile.nexon.com" in a.get("href","")]; self.assertGreaterEqual(len(official),6)
  for x in ("자는 동안에도","무한 반복 채집","황금 풍뎅이가 있으면","자동 채집 유지 시간"): self.assertNotIn(x,self.html)
if __name__=="__main__": unittest.main()
