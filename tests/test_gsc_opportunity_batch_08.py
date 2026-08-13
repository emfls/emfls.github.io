from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "kor/report/camp/gwangju-g.html": (
        "경기도 광주시 캠핑 가이드 2026 | 노지·차박 전 허용 여부 확인",
        "https://emfls.github.io/kor/report/camp/gwangju-g.html",
    ),
    "kor/report/camp/goheung.html": (
        "고흥 캠핑장 2026 | 공식 등록 캠핑장·예약 비교",
        "https://emfls.github.io/kor/report/camp/goheung.html",
    ),
    "kor/report/visa/northmacedonia.html": (
        "북마케도니아 비자: 한국 여권 90일 무비자·장기체류 안내",
        "https://emfls.github.io/kor/report/visa/northmacedonia.html",
    ),
    "kor/report/visa/senegal.html": (
        "세네갈 비자 필요할까? 한국 여권 3개월 미만 무비자·황열",
        "https://emfls.github.io/kor/report/visa/senegal.html",
    ),
    "kor/report/visa/sierra-leone.html": (
        "시에라리온 비자 2026: 한국 여권 eVisa·황열 준비",
        "https://emfls.github.io/kor/report/visa/sierra-leone.html",
    ),
}


class GscOpportunityBatch08Test(unittest.TestCase):
    def test_shared_contract(self):
        for relative, (title, canonical) in PAGES.items():
            with self.subTest(relative=relative):
                source = (ROOT / relative).read_text(encoding="utf-8")
                self.assertIn(f"<title>{title}</title>", source)
                self.assertIn(f'href="{canonical}"', source)
                expected_date = "2026-08-13" if relative == "kor/report/visa/senegal.html" else "2026-08-12"
                self.assertIn(expected_date, source)
                self.assertIn("G-QP5Q67GE5B", source)
                self.assertIn("ca-pub-8830524482034754", source)

    def test_gwangju_uses_registered_camps_not_free_wild_camping_claims(self):
        source = (ROOT / "kor/report/camp/gwangju-g.html").read_text(encoding="utf-8")
        for phrase in ("남한산성 캠핑장", "남한산 숲속캠핑장", "소설악 가족 캠핑장", "은고개 캠핑장", "신선계곡 야영장"):
            self.assertIn(phrase, source)
        for unsafe in ("완전무료", "취사가능", "텐트설치", "무료 베스트"):
            self.assertNotIn(unsafe, source)
        self.assertIn("등록", source)
        self.assertIn("예약 가능", source)

    def test_other_pages_keep_decision_critical_facts(self):
        north = (ROOT / "kor/report/visa/northmacedonia.html").read_text(encoding="utf-8")
        self.assertIn("180일 내 최대 90일", north)
        self.assertIn("C형", north)
        self.assertIn("D형", north)

        senegal = (ROOT / "kor/report/visa/senegal.html").read_text(encoding="utf-8")
        self.assertIn("3개월 미만", senegal)
        self.assertIn("6개월", senegal)
        self.assertIn("황열 위험국", senegal)

        sierra = (ROOT / "kor/report/visa/sierra-leone.html").read_text(encoding="utf-8")
        self.assertIn("신청 ID", sierra)
        self.assertIn("신청에 사용한 여권", sierra)
        self.assertIn("입국 심사관", sierra)

        goheung = (ROOT / "kor/report/camp/goheung.html").read_text(encoding="utf-8")
        self.assertIn("시설 개선", goheung)
        self.assertIn("현재 예약 가능", goheung)


if __name__ == "__main__":
    unittest.main()
