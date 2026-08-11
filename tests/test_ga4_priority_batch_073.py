import unittest
from tests.two_hundred_ga4_contract import assert_batch
from tests.fifth_hundred_ga4_manifest import BATCHES

class Ga4PriorityBatch73Test(unittest.TestCase):
    def test_contract(self):
        assert_batch(self, BATCHES[5], "fifth-hundred-ga4-priority-2026-08-11")
