from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "kor/report/camp/asan.html": ("아산 캠핑 가이드 | 곡교천·영인산 야영장 확인사항", "https://emfls.github.io/kor/report/camp/asan.html"),
    "kor/report/visa/san-marino.html": ("산마리노 비자 2026: 한국 여권·이탈리아 경유·30일 체류", "https://emfls.github.io/kor/report/visa/san-marino.html"),
    "kor/report/travel/australia-cairns.html": ("호주 케언스 여행 2026: 3박 4일·그레이트배리어리프·ETA", "https://emfls.github.io/kor/report/travel/australia-cairns.html"),
    "kor/report/travel/australia-portmacquarie.html": ("호주 포트맥쿼리 여행 2026: 해안 산책·시드니 이동·ETA", "https://emfls.github.io/kor/report/travel/australia-portmacquarie.html"),
    "game/FlappyDot/index.html": ("Flappy Dot – Free Browser Game | Spacebar & Mobile Tap", "https://emfls.github.io/game/FlappyDot/"),
}


class GscOpportunityBatch09Test(unittest.TestCase):
    def test_shared_contract(self):
        for relative, (title, canonical) in PAGES.items():
            with self.subTest(relative=relative):
                source = (ROOT / relative).read_text(encoding="utf-8")
                self.assertIn(f"<title>{title}</title>", source)
                self.assertIn(f'href="{canonical}"', source)
                self.assertIn("2026-08-12", source)
                self.assertIn("G-QP5Q67GE5B", source)

    def test_decision_facts(self):
        asan = (ROOT / "kor/report/camp/asan.html").read_text(encoding="utf-8")
        self.assertIn("매주 화요일", asan)
        self.assertIn("asancamping.co.kr", asan)
        self.assertIn("예약 가능 여부", asan)

        san_marino = (ROOT / "kor/report/visa/san-marino.html").read_text(encoding="utf-8")
        self.assertIn("솅겐 전체 합산", san_marino)
        self.assertIn("입국일과 출국일", san_marino)
        self.assertIn("30일 초과", san_marino)

        cairns = (ROOT / "kor/report/travel/australia-cairns.html").read_text(encoding="utf-8")
        self.assertIn("High Standard Tourism Operator", cairns)
        self.assertIn("구역마다", cairns)
        self.assertIn("허용·금지·허가", cairns)

        port = (ROOT / "kor/report/travel/australia-portmacquarie.html").read_text(encoding="utf-8")
        self.assertIn("Grafton XPT", port)
        self.assertIn("Wauchope", port)
        self.assertIn("연결 코치", port)

    def test_flappy_dot_consolidates_url_without_ads(self):
        source = (ROOT / "game/FlappyDot/index.html").read_text(encoding="utf-8")
        self.assertIn('<meta property="og:url" content="https://emfls.github.io/game/FlappyDot/"', source)
        self.assertIn("Spacebar", source)
        self.assertIn("tap", source)
        self.assertIn("hits a bomb or goes off-screen", source)
        self.assertNotIn("pagead2.googlesyndication.com", source)
        self.assertNotIn("adsbygoogle", source)


if __name__ == "__main__":
    unittest.main()
