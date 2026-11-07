import subprocess
import unittest
from pathlib import Path


class DiceRollTest(unittest.TestCase):
    def test_roll_results_and_independent_draws(self):
        root = Path(__file__).resolve().parents[1]
        result = subprocess.run(
            ["node", str(root / "tests/dice_roll.mjs"), str(root / "util/dice3d/index.html")],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
