import unittest
from tests.long_tail_ga4_contract import assert_manifest
from tests.long_tail_ga4_03_manifest import PAGES

class Ga4PriorityBatch90Test(unittest.TestCase):
    def test_contract(self):
        assert_manifest(self, PAGES, "ga4-long-tail-03-priority-2026-08-11")
