import unittest
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]


class Links(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.links = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.links.append(dict(attrs).get('href', ''))


class AnsanBookingRecoveryTest(unittest.TestCase):
    def test_reader_can_reach_verified_campsite_without_treating_beach_as_campsite(self):
        html = (ROOT / 'kor/report/camp/ansan.html').read_text()
        links = Links(html).links
        self.assertIn('https://hwarangcamp.ansanuc.net/main/index.do', links)
        self.assertIn('https://hwarangcamp.ansanuc.net/main/introduce.do', links)
        self.assertNotIn('이 페이지에서 고캠핑 등록을 확인한 시설 없음', html)
        for detail in ('방아머리해변', '야영·취사 금지', '28,000원', '33,000원', '11월 9~13일', '공사', '잔여석'):
            self.assertIn(detail, html)
        self.assertNotIn('무료 화랑', html)

    def test_publisher_home_button_cannot_cover_booking_link(self):
        html = (ROOT / 'kor/report/camp/ansan.html').read_text()
        home_css = html.split('/* 홈 버튼 스타일 */')[1].split('</style>')[0]
        self.assertNotIn('position: fixed', home_css)
        self.assertIn('class="home-button"', html)


if __name__ == '__main__':
    unittest.main()
