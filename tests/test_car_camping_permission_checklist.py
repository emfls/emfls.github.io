import json
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]
PAGE = ROOT / "kor/report/camp/차박.html"
APP = ROOT / "kor/report/camp/car-camping-check.js"
HUB = ROOT / "kor/report/camp/index.html"


class CarCampingPermissionChecklistTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = PAGE.read_text(encoding="utf-8")

    def test_page_answers_permission_intent(self):
        for text in (
            "차박 가능 여부 확인 체크리스트",
            "주차 허용과 숙박·취사·텐트 허용은 서로 다릅니다",
            "관리 주체",
            "현장 표지판",
            "공회전",
            "일산화탄소",
            "확인하지 못했다면 이용하지 마세요",
            "2026-08-14",
        ):
            self.assertIn(text, self.html)

    def test_links_official_sources_and_preserves_measurement(self):
        self.assertIn("https://www.gocamping.or.kr/", self.html)
        self.assertIn("https://reservation.knps.or.kr/", self.html)
        self.assertIn("https://www.law.go.kr/", self.html)
        self.assertIn("G-QP5Q67GE5B", self.html)
        self.assertIn("ca-pub-8830524482034754", self.html)
        self.assertIn('href="https://emfls.github.io/kor/report/camp/차박.html"', self.html)

    def test_checker_returns_only_conservative_outcomes(self):
        script = f"""
const {{ assessCarCamping }} = require({json.dumps(str(APP))});
const cases = [
  assessCarCamping({{manager:true, sign:true, overnight:true, setup:true, fire:true}}),
  assessCarCamping({{manager:false, sign:true, overnight:true, setup:true, fire:true}}),
  assessCarCamping({{manager:true, sign:true, overnight:null, setup:true, fire:true}})
];
process.stdout.write(JSON.stringify(cases));
"""
        result = subprocess.run(
            ["node", "-e", script], capture_output=True, text=True, check=True
        )
        cases = json.loads(result.stdout)
        self.assertEqual(cases[0]["status"], "공식 허용 확인")
        self.assertEqual(cases[1]["status"], "이용하지 않기")
        self.assertEqual(cases[2]["status"], "추가 확인 필요")

    def test_removes_unsafe_or_overbroad_advice(self):
        self.assertNotIn("2~3시간마다 시동", self.html)
        self.assertNotIn("차박이 정답", self.html)
        self.assertNotIn("지정되지 않은 곳에서의 차박은 불법", self.html)

    def test_camping_hub_describes_the_checker(self):
        hub = HUB.read_text(encoding="utf-8")
        self.assertIn("차박 가능 여부 확인 체크리스트 2026", hub)
        self.assertIn("관리 주체와 현장 표지판", hub)


if __name__ == "__main__":
    unittest.main()
