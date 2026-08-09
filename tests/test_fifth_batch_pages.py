import unittest
from pathlib import Path
from tests.test_gapyeong_camping_page import PageParser
ROOT=Path(__file__).resolve().parents[1]

TRAVEL={
"kor/report/travel/australia-bundaberg.html":("번더버그","ETA","https://www.queensland.com/"),
"kor/report/travel/austria-bad-voeslau.html":("바트뵈슬라우","90일","https://www.badvoeslau.at/"),
"kor/report/travel/australia-goldcoast.html":("골드코스트","ETA","https://www.destinationgoldcoast.com/"),}
APPS={
"jp/util/passwordgen/index.html":("パスワード","randomPassword","WebApplication"),
"game/CardMatch/index.html":("Card Match","function startGame","VideoGame"),
"ae/game/2048/index.html":("2048","function moveLeft","VideoGame"),
"game/TetrisGame/index.html":("Tetris","function clearLines","VideoGame"),
"util/dice3d/index.html":("Dice","function rollDice","WebApplication"),
"jp/game/TetrisGame/index.html":("テトリス","function clearLines","VideoGame"),}

class FifthBatchPagesTest(unittest.TestCase):
 def test_travel(self):
  for path,(place,fact,official) in TRAVEL.items():
   with self.subTest(path=path):
    h=(ROOT/path).read_text(); p=PageParser(); p.feed(h)
    self.assertIn(place,p.title+p.h1+p.meta.get("description",""))
    for x in ("한국 여권",fact,official,"공식","최근 확인","2026-08-09"): self.assertIn(x,h)
    self.assertEqual({x.get("@type") for x in p.json_ld},{"WebPage","FAQPage"})
    for x in ("G-QP5Q67GE5B","ca-pub-8830524482034754",'div[id^="aswift_"]'): self.assertIn(x,h)
 def test_apps(self):
  for path,(name,fn,typ) in APPS.items():
   with self.subTest(path=path):
    h=(ROOT/path).read_text(); p=PageParser(); p.feed(h)
    self.assertIn(name.lower(),(p.title+p.h1+p.meta.get("description","")).lower())
    for x in (fn,"2026-08-09","privacy"): self.assertIn(x.lower(),h.lower())
    self.assertEqual({x.get("@type") for x in p.json_ld},{typ,"FAQPage"})
    for x in ("G-QP5Q67GE5B","ca-pub-8830524482034754",'div[id^="aswift_"]'): self.assertIn(x,h)
 def test_visa_index(self):
  h=(ROOT/"kor/report/visa/index.html").read_text(); p=PageParser(); p.feed(h)
  for x in ("국가 검색","공식","여행경보","2026-08-09"): self.assertIn(x,h)
  self.assertEqual({x.get("@type") for x in p.json_ld},{"CollectionPage","FAQPage"})
  self.assertEqual(p.canonical,"https://emfls.github.io/kor/report/visa/")
if __name__=="__main__": unittest.main()
