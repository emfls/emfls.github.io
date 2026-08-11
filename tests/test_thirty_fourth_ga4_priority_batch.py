import unittest
from tests.next_hundred_ga4_contract import assert_batch
from tests.next_hundred_ga4_manifest import BATCHES

class ThirtyFourthBatchTest(unittest.TestCase):
    def test_contract(self): assert_batch(self, BATCHES[6])
