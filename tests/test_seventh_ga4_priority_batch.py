from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]

PAGES = {
    "kor/column/maple-planet-bishop-4th-skill-quest-guide-2026.html": ("Article", "패치", "관련"),
    "kor/column/maple-planet-no-capital-rice-farming-2026.html": ("Article", "보장", "관련"),
    "kor/column/maple-planet-suncall-blizzard-hp-zero-setup-2026.html": ("Article", "실측", "관련"),
    "kor/column/minecraft-262-geyser-multiplayer-update-2026.html": ("Article", "공식", "관련"),
    "kor/column/maple-planet-lv80-black-centaurus-leveling-2026.html": ("Article", "실측", "관련"),
    "ru/util/text-shuffle-sort/index.html": ("WebApplication", "криптограф", "Другие"),
    "ru/util/quickmemo/index.html": ("WebApplication", "localStorage", "Другие"),
    "ru/util/diff/index.html": ("WebApplication", "построчно", "Другие"),
    "kor/util/caseconverter/index.html": ("WebApplication", "번역", "관련"),
    "jp/game/ConnectFour/index.html": ("VideoGame", "引き分け", "関連"),
}


class SeventhGa4PriorityBatchTest(unittest.TestCase):
    def test_pages_have_review_contract(self):
        for relative, (schema_type, limitation, related_label) in PAGES.items():
            with self.subTest(relative=relative):
                html = (ROOT / relative).read_text(encoding="utf-8")
                expected_date = "2026-08-24" if relative.endswith(
                    (
                        "maple-planet-suncall-blizzard-hp-zero-setup-2026.html",
                        "maple-planet-lv80-black-centaurus-leveling-2026.html",
                    )
                ) else "2026-08-09"
                self.assertIn(expected_date, html)
                self.assertIn(f'"@type":"{schema_type}"', html.replace(" ", ""))
                self.assertIn(limitation.lower(), html.lower())
                self.assertIn(related_label, html)
                self.assertIn("max-width:100%", html.replace(" ", ""))

    def test_connect_four_uses_directory_canonical(self):
        html = (ROOT / "jp/game/ConnectFour/index.html").read_text(encoding="utf-8")
        self.assertIn('rel="canonical" href="https://emfls.github.io/jp/game/ConnectFour/"', html)


if __name__ == "__main__":
    unittest.main()
