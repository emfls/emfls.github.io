import unittest
from tests.long_tail_ga4_contract import assert_manifest
from tests.second_long_tail_ga4_06_manifest import PAGES

class Ga4PriorityBatch103Test(unittest.TestCase):
    def test_contract(self):
        assert_manifest(self, PAGES, "ga4-long-tail-16-priority-2026-08-11")
