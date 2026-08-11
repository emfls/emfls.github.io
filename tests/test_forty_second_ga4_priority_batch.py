import unittest
from tests.second_hundred_ga4_contract import assert_batch
from tests.second_hundred_ga4_manifest import BATCHES

class FortySecondBatchTest(unittest.TestCase):
    def test_contract(self): assert_batch(self, BATCHES[4])
