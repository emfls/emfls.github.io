import unittest
from tests.fourth_hundred_ga4_contract import assert_batch
from tests.fourth_hundred_ga4_manifest import BATCHES

class SixtySixthBatchTest(unittest.TestCase):
    def test_contract(self): assert_batch(self, BATCHES[8])
