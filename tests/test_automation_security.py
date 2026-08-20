import os
import re
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SECRET_BEARING_FILES = (
    "generate_articles.py",
    "telegram_bot.py",
    "update_coupang_products.py",
    "scripts/coupang_api.py",
)
AUTOMATION_ENTRYPOINTS = (
    "generate_articles.py",
    "telegram_bot.py",
    "update_coupang_products.py",
    "process_youtube_queue.py",
    "build_column_page.py",
    "scripts/coupang_api.py",
)


class AutomationSecurityTest(unittest.TestCase):
    def test_automation_is_disabled_by_default(self):
        from automation_security import require_automation_enabled

        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(SystemExit, "disabled by default"):
                require_automation_enabled()

    def test_automation_requires_explicit_exact_opt_in(self):
        from automation_security import require_automation_enabled

        for value in ("true", "yes", "0", " 1 "):
            with self.subTest(value=value), patch.dict(
                os.environ, {"EMFLS_AUTOMATION_ENABLED": value}, clear=True
            ):
                with self.assertRaises(SystemExit):
                    require_automation_enabled()

        with patch.dict(os.environ, {"EMFLS_AUTOMATION_ENABLED": "1"}, clear=True):
            require_automation_enabled()

    def test_required_credentials_come_from_environment(self):
        from automation_security import required_env

        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "COUPANG_PARTNERS_ACCESS_KEY"):
                required_env("COUPANG_PARTNERS_ACCESS_KEY")

        with patch.dict(os.environ, {"COUPANG_PARTNERS_ACCESS_KEY": "temporary"}, clear=True):
            self.assertEqual("temporary", required_env("COUPANG_PARTNERS_ACCESS_KEY"))

    def test_tracked_automation_has_no_embedded_credentials(self):
        token_patterns = (
            re.compile(r"github_pat_[A-Za-z0-9_]+"),
            re.compile(r"\b\d{8,12}:[A-Za-z0-9_-]{30,}\b"),
            re.compile(r"https://[^/\s:@]+:[^/\s@]+@github\.com"),
            re.compile(
                r"(?:ACCESS_KEY|SECRET_KEY|COUPANG_ACCESS|COUPANG_SECRET|"
                r"BOT_TOKEN|TELEGRAM_TOKEN|GIT_TOKEN)\s*=\s*['\"][^'\"]+['\"]"
            ),
        )
        for relative in SECRET_BEARING_FILES:
            source = (ROOT / relative).read_text(encoding="utf-8")
            for pattern in token_patterns:
                self.assertIsNone(pattern.search(source), f"embedded credential in {relative}")

    def test_every_automation_entrypoint_uses_the_default_off_guard(self):
        for relative in AUTOMATION_ENTRYPOINTS:
            source = (ROOT / relative).read_text(encoding="utf-8")
            self.assertIn("require_automation_enabled()", source, relative)

    def test_every_automation_entrypoint_fails_closed_without_environment(self):
        safe_env = {"PATH": os.environ.get("PATH", "")}
        for relative in AUTOMATION_ENTRYPOINTS:
            completed = subprocess.run(
                [sys.executable, relative],
                cwd=ROOT,
                env=safe_env,
                capture_output=True,
                text=True,
                timeout=5,
            )
            output = completed.stdout + completed.stderr
            self.assertNotEqual(0, completed.returncode, relative)
            self.assertIn("disabled by default", output, relative)

    def test_local_environment_files_are_ignored(self):
        gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8")
        self.assertRegex(gitignore, r"(?m)^\.env$")
        self.assertRegex(gitignore, r"(?m)^\.env\.local$")


if __name__ == "__main__":
    unittest.main()
