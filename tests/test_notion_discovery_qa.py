"""The trusted publisher must fail closed without rewriting staged site outputs."""
from pathlib import Path
import importlib.util
import json
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts/run_notion_discovery_qa.py'


class DiscoveryQaTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(SCRIPT.is_file(), 'Shared pre-merge QA runner is missing')
        spec = importlib.util.spec_from_file_location('discovery_qa', SCRIPT)
        self.qa = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.qa)
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'scripts').mkdir()
        for name in ('refresh_notion_discovery.py', 'build_content_index.py'):
            shutil.copy2(ROOT / 'scripts' / name, self.root / 'scripts' / name)
        (self.root / 'data').mkdir()
        (self.root / 'kor/report/it').mkdir(parents=True)
        self.destination = 'kor/report/it/example.html'
        (self.root / self.destination).write_text('<html><title>Example guide</title><main><section class="info-bottom">Source</section></main></html>')
        (self.root / 'index.html').write_text('<main>    <section class="section"><h2>최신 콘텐츠</h2></section></main>')
        (self.root / 'kor/report/it/index.html').write_text('<main><div class="grid">Old</div></main>')
        (self.root / 'feed.xml').write_text('<rss><channel><title>Site</title></channel></rss>')
        (self.root / 'data/scheduled-publication-ledger.jsonl').write_text(json.dumps({'notionPageId': 'example', 'url': 'https://emfls.github.io/' + self.destination, 'slotKst': '2026-11-10T12:00:00+09:00'}) + '\n')

        old = 'kor/report/it/old-example.html'
        shutil.copy2(self.root / self.destination, self.root / old)
        with (self.root / 'data/scheduled-publication-ledger.jsonl').open('a') as ledger:
            ledger.write(json.dumps({'notionPageId': 'old-example', 'url': 'https://emfls.github.io/' + old, 'slotKst': '2026-11-09T12:00:00+09:00'}) + '\n')

    def snapshot(self):
        return {str(p.relative_to(self.root)): p.read_bytes() for p in self.root.rglob('*') if p.is_file()}

    def test_integration_uses_current_inputs_without_changing_source(self):
        before = self.snapshot()
        self.qa.run_integration(self.root)
        self.assertEqual(self.snapshot(), before)

    def test_missing_ledger_fails_closed(self):
        (self.root / 'data/scheduled-publication-ledger.jsonl').write_text('')
        with self.assertRaisesRegex(ValueError, 'No Notion publication ledger'):
            self.qa.run_integration(self.root)

    def test_staged_destination_must_already_pass_validation(self):
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, 'discovery'):
            self.qa.run_integration(self.root, self.destination)
        self.assertEqual(self.snapshot(), before)

    def test_successful_staged_outputs_are_preserved(self):
        subprocess.run(['python3', 'scripts/refresh_notion_discovery.py', self.destination], cwd=self.root, check=True)
        subprocess.run(['python3', 'scripts/build_content_index.py'], cwd=self.root, check=True)
        before = self.snapshot()
        self.qa.run_integration(self.root, self.destination)
        self.assertEqual(self.snapshot(), before)

    def test_staged_article_missing_from_index_fails_closed(self):
        subprocess.run(['python3', 'scripts/refresh_notion_discovery.py', self.destination], cwd=self.root, check=True)
        (self.root / 'data/content-index-ko.json').write_text('[]')
        with self.assertRaisesRegex(ValueError, 'absent from content index'):
            self.qa.run_integration(self.root, self.destination)

    def test_staged_article_missing_from_rss_fails_closed(self):
        subprocess.run(['python3', 'scripts/refresh_notion_discovery.py', self.destination], cwd=self.root, check=True)
        (self.root / 'feed.xml').write_text('<rss><channel /></rss>')
        with self.assertRaisesRegex(ValueError, 'absent from RSS'):
            self.qa.run_integration(self.root, self.destination)

    def test_destination_outside_site_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'destination'):
            self.qa.run_integration(self.root, '../outside.html')

    def test_regression_failure_stops_before_later_suites(self):
        (self.root / 'tests').mkdir()
        for index, pattern in enumerate(self.qa.TEST_PATTERNS):
            code = 'import unittest\nclass Check(unittest.TestCase):\n def test_check(self):\n  self.fail("injected regression")\n' if index == 0 else 'raise RuntimeError("later suite must not run")\n'
            (self.root / 'tests' / pattern).write_text(code)
        with self.assertRaises(subprocess.CalledProcessError) as caught:
            self.qa.run_regressions(self.root)
        self.assertIn(self.qa.TEST_PATTERNS[0], caught.exception.cmd)

    def test_standalone_workflow_shares_runner_and_retains_pr_checks(self):
        workflow = (ROOT / '.github/workflows/notion-discovery-qa.yml').read_text()
        self.assertIn('pull_request:', workflow)
        self.assertIn('workflow_dispatch:', workflow)
        self.assertIn('python3 scripts/run_notion_discovery_qa.py', workflow)
        self.assertNotIn('pull_request_target:', workflow)


if __name__ == '__main__':
    unittest.main()
