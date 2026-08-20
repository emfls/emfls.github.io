import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GENERATORS = (ROOT / "generate_articles.py", ROOT / "build_column_page.py")
PUBLIC_ORIGIN = "https://emfls.github.io"
RETIRED_ORIGIN = "https://emfls.com"


class GeneratorDomainContractTests(unittest.TestCase):
    def test_generators_do_not_reference_retired_origin(self):
        for path in GENERATORS:
            with self.subTest(path=path.name):
                self.assertNotIn(RETIRED_ORIGIN, path.read_text(encoding="utf-8"))

    def test_generators_use_github_pages_origin(self):
        for path in GENERATORS:
            with self.subTest(path=path.name):
                spec = importlib.util.spec_from_file_location(path.stem, path)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                self.assertEqual(module.SITE_URL, PUBLIC_ORIGIN)


if __name__ == "__main__":
    unittest.main()
