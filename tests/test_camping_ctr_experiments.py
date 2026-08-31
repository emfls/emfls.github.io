import json
import re
import unittest
from pathlib import Path


PAGES = {
    "nonsan": {
        "url": "/kor/report/camp/nonsan.html",
        "title": "논산 캠핑·차박 장소 8곳 | 주차·화장실·야영 전 확인사항",
        "description": "논산 황산대교·탑정호 주변과 등록 캠핑장 8곳을 비교합니다. 장소별 주차·화장실·취사 정보와 야영 전 확인할 현장 제한을 정리했습니다.",
        "h1": "🌾 논산시 노지 캠핑장 완전 가이드",
        "answer": "논산에서 캠핑·차박 장소를 고를 때는 황산대교·탑정호 주변 후보와 등록 캠핑장을 구분해 확인해야 합니다. 이 페이지에서는 8곳의 위치와 주차·화장실·취사 정보를 비교하고, 출발 전 야영 허용 여부를 확인하는 기준을 정리합니다.",
        "baseline": (560, 21, 0.038),
    },
    "cheorwon": {
        "url": "/kor/report/camp/cheorwon.html",
        "title": "철원 캠핑·차박 장소 정리 | 한탄강·등록 캠핑장 이용 전 확인",
        "description": "철원 승일교·한탄강 주변과 등록 캠핑장을 비교합니다. 장소별 주차·화장실 정보, 야간 차박·취사 제한과 출발 전 확인사항을 살펴보세요.",
        "h1": "🌉 철원 캠핑: 등록 시설과 야영 가능 여부 확인",
        "answer": "철원에서 캠핑·차박 장소를 찾는다면 승일교·한탄강 주변 관광지와 등록 캠핑장의 이용 조건을 먼저 구분해야 합니다. 이 페이지에서는 장소별 주차·화장실 정보와 야간 숙박·취사 제한을 비교하고, 현장 공지를 확인할 항목을 정리합니다.",
        "baseline": (529, 27, 0.051),
    },
    "uljin": {
        "url": "/kor/report/camp/uljin.html",
        "title": "울진 캠핑·차박 장소 6곳 | 해변·계곡 주차·화장실 확인",
        "description": "울진 구산·봉평 해변과 불영계곡 주변 캠핑 장소 6곳을 비교합니다. 주차·화장실·취사 정보와 야영 전 확인할 현장 제한을 정리했습니다.",
        "h1": "🌊 울진군 노지 캠핑장 완전 가이드",
        "answer": "울진에서 캠핑·차박 장소를 찾는다면 구산·봉평 해변, 불영계곡 주변과 등록 캠핑장의 이용 조건을 비교하세요. 이 페이지에서는 6곳의 주차·화장실·취사 정보를 살펴보고, 해변·계곡의 야영 허용 여부를 출발 전에 확인할 수 있도록 정리합니다.",
        "baseline": (704, 40, 0.057),
    },
}


class CampingCtrPageTest(unittest.TestCase):
    def test_only_approved_page_contracts_have_new_snippets_and_preserved_safety_markers(self):
        for name, expected in PAGES.items():
            with self.subTest(page=name):
                source = Path(f"kor/report/camp/{name}.html").read_text(encoding="utf-8")
                self.assertIn(f"<title>{expected['title']}</title>", source)
                self.assertIn(f'<meta name="description" content="{expected["description"]}">', source)
                self.assertIn(f"<h1>{expected['h1']}</h1>", source)
                self.assertIn(f'<p data-ctr-experiment="2026-09-01">{expected["answer"]}</p>', source)
                self.assertEqual(source.count("<title>"), 1)
                self.assertEqual(source.count('meta name="description"'), 1)
                self.assertEqual(source.count("<h1>"), 1)
                self.assertIn(f'<link rel="canonical" href="https://emfls.github.io{expected["url"]}">', source)
                self.assertEqual(source.count("adsbygoogle"), 2)
                self.assertEqual(source.count("gtag("), 3)
                for payload in re.findall(r'<script type="application/ld\+json">(.*?)</script>', source, re.S):
                    json.loads(payload)


class CampingCtrRegistryTest(unittest.TestCase):
    def test_registry_contains_exactly_three_independent_observing_experiments(self):
        registry = json.loads(Path("data/experiments.json").read_text(encoding="utf-8"))
        experiments = registry["experiments"]
        self.assertEqual(len(experiments), 3)
        self.assertEqual({row["url"] for row in experiments}, {row["url"] for row in PAGES.values()})
        for row in experiments:
            expected = next(item for item in PAGES.values() if item["url"] == row["url"])
            self.assertEqual(row["status"], "OBSERVING")
            self.assertEqual(row["started"], "2026-09-01")
            self.assertEqual(row["observe_until"], "2026-09-29")
            self.assertEqual(row["cooldownUntil"], "2026-09-29")
            self.assertEqual(row["searchIntentStatus"], "ESTIMATED_SEARCH_INTENT")
            self.assertEqual(row["naverRank"], {"value": None, "status": "NOT_AVAILABLE"})
            self.assertEqual(
                (row["before"]["naver"]["impressions"], row["before"]["naver"]["clicks"], row["before"]["naver"]["ctr"]),
                expected["baseline"],
            )
            self.assertEqual(row["before"]["ga4"]["status"], "NOT_CONNECTED")
            self.assertEqual(row["successCriteria"]["compare"], ["impressions", "clicks", "ctr"])


if __name__ == "__main__":
    unittest.main()
