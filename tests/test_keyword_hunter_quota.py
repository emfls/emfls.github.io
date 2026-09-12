import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import Mock
from urllib.error import HTTPError

from scripts.keyword_hunter_api import Client
from scripts.keyword_hunter_core import DEFAULT_CONFIG
from scripts.keyword_hunter_quota import DataLabUsage

KST=timezone(timedelta(hours=9))


class DataLabQuotaTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name)
        self.now=datetime(2026,9,10,10,0,tzinfo=KST)

    def tearDown(self): self.tmp.cleanup()

    def test_budget_uses_remaining_month_day_and_two_hour_runs(self):
        usage=DataLabUsage(self.root,monthly_limit=50000,reserve_ratio=.10,now=lambda:self.now)
        snap=usage.snapshot()
        self.assertEqual(snap['usable_budget'],45000)
        self.assertEqual(snap['remaining_days'],21)
        self.assertEqual(snap['remaining_runs_today'],7)
        self.assertEqual(snap['run_budget'],306)

    def test_usage_is_persistent_and_month_rollover_retains_history(self):
        usage=DataLabUsage(self.root,now=lambda:self.now)
        usage.record_attempt(); usage.record_attempt()
        self.assertEqual(DataLabUsage(self.root,now=lambda:self.now).snapshot()['used_this_month'],2)
        october=self.now.replace(month=10,day=1)
        DataLabUsage(self.root,now=lambda:october).record_attempt()
        data=json.loads((self.root/'data/api_usage.json').read_text())
        self.assertEqual(data['months']['2026-09']['calls'],2)
        self.assertEqual(data['months']['2026-10']['calls'],1)

    def test_every_http_attempt_including_retry_is_counted(self):
        usage=DataLabUsage(self.root,now=lambda:self.now)
        response=Mock(side_effect=[HTTPError('https://x',500,'bad',{},None),b'{"results":[]}'])
        env={'NAVER_DATALAB_CLIENT_ID':'id','NAVER_DATALAB_CLIENT_SECRET':'secret'}
        client=Client(dict(DEFAULT_CONFIG,request_interval=0),env=env,transport=response,sleep=Mock(),usage_tracker=usage)
        client.trends(['하나'],self.now.date())
        self.assertEqual(usage.snapshot()['used_this_month'],2)
        self.assertEqual(client.datalab_calls,2)
        self.assertEqual(client.datalab_keywords_submitted,1)
        self.assertEqual(client.datalab_keywords_validated,0)

    def test_exhausted_datalab_budget_does_not_block_search_ads(self):
        usage=DataLabUsage(self.root,monthly_limit=147,reserve_ratio=0,now=lambda:self.now)
        usage.record_attempt()
        env={'NAVER_DATALAB_CLIENT_ID':'id','NAVER_DATALAB_CLIENT_SECRET':'secret',
             'NAVER_SEARCHAD_API_KEY':'key','NAVER_SEARCHAD_SECRET_KEY':'secret','NAVER_SEARCHAD_CUSTOMER_ID':'1'}
        transport=Mock(return_value=b'{"keywordList":[]}')
        client=Client(dict(DEFAULT_CONFIG,request_interval=0),env=env,transport=transport,sleep=Mock(),usage_tracker=usage)
        self.assertEqual(client.trends(['하나'],self.now.date()),{})
        self.assertEqual(client.related('독립 seed'),[])
        self.assertEqual(transport.call_count,1)

    def test_batch_efficiency_tracks_five_groups_per_call(self):
        usage=DataLabUsage(self.root,now=lambda:self.now)
        def response(req):
            groups=json.loads(req.data)['keywordGroups']
            return json.dumps({'results':[{'title':g['groupName'],'data':[]} for g in groups]}).encode()
        env={'NAVER_DATALAB_CLIENT_ID':'id','NAVER_DATALAB_CLIENT_SECRET':'secret'}
        client=Client(dict(DEFAULT_CONFIG,request_interval=0),env=env,transport=response,usage_tracker=usage)
        client.trends(['k'+str(i) for i in range(12)],self.now.date())
        self.assertEqual(client.datalab_calls,3)
        self.assertEqual(client.datalab_keywords_submitted,12)
        self.assertEqual(client.datalab_keywords_validated,0)
        self.assertEqual(client.datalab_average_keywords_per_call,4.0)
