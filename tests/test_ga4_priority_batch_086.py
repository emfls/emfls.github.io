import unittest
from tests.two_hundred_ga4_contract import assert_batch
from tests.sixth_hundred_ga4_manifest import BATCHES

class Ga4PriorityBatch86Test(unittest.TestCase):
    def test_contract(self):
        assert_batch(self, BATCHES[8], "sixth-hundred-ga4-priority-2026-08-11")
