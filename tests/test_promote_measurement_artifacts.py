import tempfile
import unittest
from pathlib import Path

from scripts.promote_measurement_artifacts import promote_artifacts


class PromoteMeasurementArtifactsTest(unittest.TestCase):
    def test_missing_generated_output_leaves_last_good_files_unchanged(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            sources = [root / "new-page.json", root / "new-opportunities.json", root / "missing-report.md"]
            targets = [root / "page.json", root / "opportunities.json", root / "report.md"]
            for source, target, content in zip(sources[:2], targets, ("last-page", "last-opportunities")):
                source.write_text("new-" + content, encoding="utf-8")
                target.write_text(content, encoding="utf-8")
            targets[2].write_text("last-report", encoding="utf-8")

            with self.assertRaises(FileNotFoundError):
                promote_artifacts(sources, targets)

            self.assertEqual([target.read_text(encoding="utf-8") for target in targets], ["last-page", "last-opportunities", "last-report"])

    def test_promotes_all_validated_outputs(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            sources = [root / "new-page.json", root / "new-opportunities.json", root / "new-report.md"]
            targets = [root / "page.json", root / "opportunities.json", root / "report.md"]
            for index, source in enumerate(sources):
                source.write_text(f"new-{index}", encoding="utf-8")

            promote_artifacts(sources, targets)

            self.assertEqual([target.read_text(encoding="utf-8") for target in targets], ["new-0", "new-1", "new-2"])


if __name__ == "__main__":
    unittest.main()
