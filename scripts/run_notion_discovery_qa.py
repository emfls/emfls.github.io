#!/usr/bin/env python3
"""Shared read-only QA gate for PRs and trusted pre-merge Notion publishing.

Generators run only in a temporary copy of the current working tree inputs,
including an uncommitted staged article/ledger. This must never repair or change
what the publisher will commit. No credentials, network, or approval changes.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
TEST_PATTERNS = (
    'test_pages_deployment_recovery.py',
    'test_notion_discovery.py',
    'test_homepage_seo.py',
    'test_notion_discovery_qa.py',
)
ROUTE = re.compile(r'^kor/report/[a-z0-9-]+/[a-z0-9-]+\.html$')


def run_regressions(root: Path) -> None:
    for pattern in TEST_PATTERNS:
        if not (root / 'tests' / pattern).is_file():
            raise ValueError('Missing required regression suite: ' + pattern)
        subprocess.run([sys.executable, '-B', '-m', 'unittest', 'discover',
                        '-s', 'tests', '-p', pattern, '-v'], cwd=root, check=True)


def validate_outputs(root: Path, destination: str) -> None:
    dest = Path(destination)
    for path in (root / 'index.html', root / dest.parent / 'index.html', root / dest):
        if 'notion-discovery:start' not in path.read_text(encoding='utf-8'):
            raise ValueError('Missing discovery links: ' + str(path.relative_to(root)))
    if '/kor/report/recent/' not in (root / 'index.html').read_text(encoding='utf-8'):
        raise ValueError('Missing discovery archive link')
    if not (root / 'kor/report/recent/index.html').is_file():
        raise ValueError('Missing discovery archive')
    links = [node.text for node in ET.parse(root / 'feed.xml').findall('./channel/item/link')]
    if 'https://emfls.github.io/' + destination not in links:
        raise ValueError('Staged article absent from RSS')
    rows = json.loads((root / 'data/content-index-ko.json').read_text(encoding='utf-8'))
    if not any(row.get('url') == '/' + destination for row in rows):
        raise ValueError('Staged article absent from content index')


def run_integration(root: Path, destination: str | None = None) -> None:
    if destination is not None:
        if not ROUTE.fullmatch(destination):
            raise ValueError('Invalid Notion destination')
        # Validate the actual staged output before generators could conceal a bug.
        validate_outputs(root, destination)
    with tempfile.TemporaryDirectory(prefix='notion-discovery-qa-') as temporary:
        copy = Path(temporary)
        for name in ('scripts', 'kor', 'data'):
            shutil.copytree(root / name, copy / name, ignore=shutil.ignore_patterns('__pycache__'))
        for name in ('index.html', 'feed.xml'):
            shutil.copy2(root / name, copy / name)
        spec = importlib.util.spec_from_file_location('qa_discovery', copy / 'scripts/refresh_notion_discovery.py')
        discovery = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(discovery)
        rows = discovery.get_entries()
        if not rows:
            raise ValueError('No Notion publication ledger entries available')
        destination = destination or rows[0]['relative']
        if not any(row['relative'] == destination for row in rows):
            raise ValueError('Staged destination absent from Notion publication ledger')
        subprocess.run([sys.executable, '-B', 'scripts/refresh_notion_discovery.py', destination], cwd=copy, check=True)
        subprocess.run([sys.executable, '-B', 'scripts/build_content_index.py', '--ops-dir', str(copy)], cwd=copy, check=True)
        validate_outputs(copy, destination)
    print('INTEGRATION_DISCOVERY_PASS', flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination', help='Validate the actual staged article before isolated integration')
    args = parser.parse_args()
    for name in ('refresh_notion_discovery.py', 'recover_pages_deployment.py',
                 'build_content_index.py', 'run_notion_discovery_qa.py'):
        path = ROOT / 'scripts' / name
        compile(path.read_text(encoding='utf-8'), str(path), 'exec')
    run_regressions(ROOT)
    run_integration(ROOT, args.destination)
    subprocess.run(['git', 'diff', '--check'], cwd=ROOT, check=True)
    print('NOTION_DISCOVERY_QA_PASS', flush=True)


if __name__ == '__main__':
    main()
