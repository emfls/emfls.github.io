from html import unescape
from pathlib import Path
import unittest


class WolasanFacilitiesTest(unittest.TestCase):
    def test_deck_and_glamping_are_distinct_with_source_and_limits(self):
        html = unescape((Path(__file__).resolve().parents[1] / "kor/report/camp/jinju.html").read_text())
        card = html.split("<!-- 진주 월아산 자연휴양림 -->")[1].split("<!-- 진주 기타 캠핑장들 -->")[0]
        for fact in (
            "야영데크 5개 · 각 35㎡(5m×7m) · 최대 6명",
            "글램핑장 7개 · 각 38㎡ · 최대 4명",
            "https://www.foresttrip.go.kr/pot/rm/fa/selectCmpgrArmpListView.do?hmpgId=ID02030114&menuId=002002002",
            "시설 목록은 희망일의 빈자리나 운영 여부를 보장하지 않습니다.",
        ):
            self.assertIn(fact, card)


if __name__ == "__main__":
    unittest.main()
