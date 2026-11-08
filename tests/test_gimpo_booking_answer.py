import unittest
from pathlib import Path

from tests.test_gapyeong_camping_page import PageParser

ROOT = Path(__file__).resolve().parents[1]
BOOKING = 'https://m.thankqcamping.com/resv/view.hbb?cseq=2249&go_main=Y&path=RP'


class GimpoBookingAnswerTest(unittest.TestCase):
    def test_verified_facility_precedes_unconfirmed_places_and_has_real_booking_path(self):
        html = (ROOT / 'kor/report/camp/gimpo.html').read_text()
        grid = html.split('<div class="camping-grid">', 1)[1]
        self.assertLess(grid.index('id="gimpo-booking"'), grid.index('③ 전류리포구'))
        page = PageParser(); page.feed(html)
        hrefs = {a.get('href') for a in page.links}
        self.assertIn('#gimpo-booking', hrefs)
        self.assertIn(BOOKING, hrefs)
        self.assertIn('https://www.kimpocamp.com/things-to-do', hrefs)
        self.assertEqual(page.canonical, 'https://emfls.github.io/kor/report/camp/gimpo.html')

    def test_home_link_does_not_overlay_booking_actions(self):
        html = (ROOT / 'kor/report/camp/gimpo.html').read_text()
        css = html.split('/* 홈 버튼 스타일 */', 1)[1].split('</style>', 1)[0]
        self.assertFalse('position: fixed' in css, 'fixed home link covers booking CTA at viewport bottom')
        self.assertIn('class="home-button"', html)

    def test_costs_conditions_and_unverified_boundaries_are_explicit(self):
        html = (ROOT / 'kor/report/camp/gimpo.html').read_text()
        for text in ('40,000원', '59,000원', '69,000원', '공휴일 전날', '7~8월',
                     '13:00', '11:00', '차량 1대', '차량 2대', '온수',
                     '텐트·침구 제공 여부', '차박', '2026-11-08', '상품별',
                     '전류리포구', '숙박 허용 미확인', '현재 휴업'):
            self.assertIn(text, html)
        self.assertNotIn('무료 김포한강', html)
        self.assertNotIn('오늘 예약 가능', html)


if __name__ == '__main__':
    unittest.main()
