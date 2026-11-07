from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class CampingBookingAndFeePathsTest(unittest.TestCase):
    def test_suwon_primary_campsite_has_official_booking_and_notices(self):
        html = (ROOT / "kor/report/camp/suwon.html").read_text()
        first_card = html.split('<div class="camping-grid">')[1].split('<!-- emfls-manual-ad:')[0]
        for url in (
            'href="https://forest.maketicket.co.kr/ticket/GD129"',
            'href="https://www.suwonudc.co.kr/ggcamping/mainPage.do"',
        ):
            self.assertTrue(url in first_card, "Primary campsite needs its reviewed booking/notice path")

    def test_siheung_jump_reaches_distinct_deck_fee_and_arrival_details(self):
        html = (ROOT / "kor/report/camp/siheung.html").read_text()
        self.assertTrue('href="#gaetgol-camping"' in html, "Provide a direct route to the campground card")
        self.assertTrue(html.count('id="gaetgol-camping"') == 1, "Jump must identify one existing card")
        card = html.split('id="gaetgol-camping"')[1].split('<div class="camping-card">')[0]
        for fact in (
            "47,000원(데크 42,000원 + 전기료 5,000원)",
            "26,000원(21,000원 + 전기료 5,000원)",
            "기준 4명·최대 6명", "36개월 이상", "4,200원", "14시", "대형주차장", "공원 전기차",
        ):
            self.assertTrue(fact in card, f"Missing source-backed decision detail: {fact}")
        self.assertFalse("시흥시민 감면대상 요금 50% 할인" in card, "Do not imply electricity is discounted")


if __name__ == "__main__":
    unittest.main()
