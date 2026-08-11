import unittest
from tests.long_tail_ga4_contract import assert_manifest
from tests.final_ga4_inventory_10_manifest import PAGES

class Ga4PriorityBatch117Test(unittest.TestCase):
    def test_contract(self):
        assert_manifest(self, PAGES, "ga4-final-10-priority-2026-08-11", 100)
