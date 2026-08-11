import unittest
from tests.third_hundred_ga4_contract import assert_batch
from tests.third_hundred_ga4_manifest import BATCHES

class FiftySixthBatchTest(unittest.TestCase):
    def test_contract(self): assert_batch(self, BATCHES[8])
