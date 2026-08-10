from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
PAGES = {
 "kor/report/travel/indonesia-bogor.html":("WebPage","입국","관련"),
 "kor/report/travel/mongolia-nalaikh.html":("WebPage","입국","관련"),
 "kor/report/travel/portugal-obidos.html":("WebPage","입국","관련"),
 "kor/report/travel/spain-palma-mallorca.html":("WebPage","입국","관련"),
 "kor/report/travel/switzerland-geneva.html":("WebPage","입국","관련"),
 "kor/report/visa/china.html":("WebPage","공식","관련"),
 "kor/report/visa/kenya.html":("WebPage","공식","관련"),
 "ru/util/UniversalCodeMinifier/index.html":("WebApplication","синтаксис","Другие"),
 "ru/util/tts/index.html":("WebApplication","голос","Другие"),
 "util/quickmemo/index.html":("WebApplication","localStorage","Related"),
}

class ThirteenthGa4PriorityBatchTest(unittest.TestCase):
 def test_contract(self):
  for relative,(schema,limit,related) in PAGES.items():
   with self.subTest(relative=relative):
    html=(ROOT/relative).read_text(encoding="utf-8"); compact="".join(html.split())
    self.assertIn("2026-08-10",html); self.assertIn(f'"@type":"{schema}"',compact)
    self.assertIn(limit.lower(),html.lower()); self.assertIn(related,html); self.assertIn("max-width:100%",compact)

if __name__=="__main__": unittest.main()
