import subprocess
import unittest
from pathlib import Path


class QrImageReaderTest(unittest.TestCase):
    def test_reader_state_and_error_recovery(self):
        script = Path(__file__).with_name("qrcode_image_reader.cjs")
        result = subprocess.run(["node", "--test", "--test-reporter=tap", str(script)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
