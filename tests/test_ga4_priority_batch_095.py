import unittest
from tests.long_tail_ga4_contract import assert_manifest
from tests.long_tail_ga4_08_manifest import PAGES

class Ga4PriorityBatch95Test(unittest.TestCase):
    def test_contract(self):
        assert_manifest(self, PAGES, "ga4-long-tail-08-priority-2026-08-11")
