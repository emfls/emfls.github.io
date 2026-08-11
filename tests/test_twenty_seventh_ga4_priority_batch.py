import unittest
from tests.next_fifty_ga4_contract import assert_batch
from tests.next_fifty_ga4_manifest import BATCHES

class TwentySeventhBatchTest(unittest.TestCase):
    def test_contract(self): assert_batch(self, BATCHES[4])
