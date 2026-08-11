import unittest
from tests.fifty_ga4_manifest import BATCHES
from tests.fifty_ga4_contract import assert_batch
class TwentySecondBatchTest(unittest.TestCase):
 def test_contract(self): assert_batch(self,BATCHES[4])
