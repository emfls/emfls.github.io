import unittest
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class Links(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.links = []
        self.ids = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.append(attrs["id"])
        if tag == "a":
            self.links.append(attrs.get("href", ""))


class MobileCampingBookingRecoveryTest(unittest.TestCase):
    def test_sejong_separates_equipped_tent_price_from_auto_and_links_real_booking(self):
        html = (ROOT / "kor/report/camp/sejong.html").read_text()
        self.assertIn("https://sjfmc.moonhwain.net:451/rsvc/rsv_srm.html?b_id=jeonwolsan", Links(html).links)
        for detail in ("23,000원", "28,000원", "35,000원", "45,000원", "3,000원", "수요일", "카라반", "장작"):
            self.assertIn(detail, html)
        self.assertIn("2026~2027년 겨울 운영·휴장 일정은 아직 확인되지", html)
        self.assertIn("국사봉", html)
        self.assertIn("야영 허용 미확인", html)

    def test_boryeong_jump_targets_bookable_facility_not_unverified_beach(self):
        html = (ROOT / "kor/report/camp/boryeong.html").read_text()
        parsed = Links(html)
        self.assertIn("#seongjusan-camping", parsed.links)
        self.assertEqual(parsed.ids.count("seongjusan-camping"), 1)
        card = html.split('id="seongjusan-camping"')[1].split("</article>")[0]
        for detail in ("오전 9시", "동절기", "관리사무실", "데크", "타프", "주차장 차박", "81541"):
            self.assertIn(detail, card)
        self.assertIn("지정 야영구역 확인 필요", html)

    def test_naju_jump_and_booking_identify_byeolbam_without_inventing_nature_story_route(self):
        html = (ROOT / "kor/report/camp/naju.html").read_text()
        parsed = Links(html)
        self.assertIn("#byeolbam-camping", parsed.links)
        self.assertEqual(parsed.ids.count("byeolbam-camping"), 1)
        booking = "https://camfit.co.kr/camp/6321e6e27c91db001eed88b9"
        self.assertIn(booking, parsed.links)
        self.assertNotIn("https://starrynaight.modoo.at/", parsed.links)
        nature = html.split("<!-- 자연애스토리 -->")[1].split("<!-- 나주 기타")[0]
        self.assertNotIn(booking, nature)
        self.assertIn("현행 운영 상태와 요금은 운영처에서 확인", nature)


if __name__ == "__main__":
    unittest.main()
