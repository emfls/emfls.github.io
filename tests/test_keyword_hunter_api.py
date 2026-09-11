import json
import unittest
from datetime import date,timedelta
from unittest.mock import Mock
from urllib.error import HTTPError
from scripts.keyword_hunter_api import Client, search_ads_hint, trend_changes
from scripts.keyword_hunter_core import DEFAULT_CONFIG

class ApiTests(unittest.TestCase):
    def client(self,transport):
        return Client(dict(DEFAULT_CONFIG,request_interval=0),env={'NAVER_SEARCHAD_API_KEY':'test','NAVER_SEARCHAD_SECRET_KEY':'secret','NAVER_SEARCHAD_CUSTOMER_ID':'123','NAVER_DATALAB_CLIENT_ID':'test','NAVER_DATALAB_CLIENT_SECRET':'secret'},transport=transport,sleep=Mock())
    def test_retry_then_success(self):
        t=Mock(side_effect=[HTTPError('https://x',429,'rate',{},None),HTTPError('https://x',503,'bad',{},None),'{"keywordList":[{"relKeyword":"텐트 가격"}]}'.encode()])
        c=self.client(t)
        self.assertEqual(c.related('텐트')[0]['keyword'],'텐트 가격')
        self.assertEqual(c.rate_limits,1)
        self.assertEqual([x.args[0] for x in c.sleep.call_args_list],[30,2])
    def test_failure_isolated_and_secret_redacted(self):
        c=self.client(Mock(side_effect=[HTTPError('https://x',403,'secret',{},None),'{"keywordList":[{"relKeyword":"다음"}]}'.encode()]))
        self.assertEqual(c.related('실패'),[])
        self.assertEqual(c.related('성공')[0]['keyword'],'다음')
        self.assertNotIn('secret',str(c.errors))
        self.assertEqual(c.errors[0]['seed'],'실패')
    def test_budget_counts_retries(self):
        c=self.client(Mock(side_effect=HTTPError('https://x',500,'bad',{},None)))
        c.config['max_api_calls']=2
        self.assertEqual(c.related('텐트'),[])
        self.assertEqual(c.calls,2)
    def test_signature_and_censored_volume(self):
        t=Mock(return_value=b'{"keywordList":[{"relKeyword":"test","monthlyPcQcCnt":"< 10","monthlyMobileQcCnt":20,"compIdx":"LOW"}]}')
        c=self.client(t); r=c.related('텐트')[0]
        self.assertEqual(r['monthly_total'],20)
        self.assertEqual(r['source_seed'],'텐트')
        self.assertEqual(r['volume_note'],'LOWER_BOUND_CENSORED')
        self.assertTrue(t.call_args.args[0].get_header('X-signature'))
        self.assertIn('hintKeywords=',t.call_args.args[0].full_url)

    def test_search_ads_hint_compacts_long_external_title(self):
        hint=search_ads_hint('정수기 렌탈 계약해지·관리 미흡 소비자피해')
        self.assertLessEqual(len(hint),20)
        self.assertNotIn('·',hint)
        self.assertTrue(hint.startswith('정수기렌탈'))
    def test_datalab_batches(self):
        def response(req):
            groups=json.loads(req.data)['keywordGroups']
            return json.dumps({'results':[{'title':g['groupName'],'data':[]} for g in groups]}).encode()
        c=self.client(response)
        self.assertEqual(len(c.trends(['k'+str(i) for i in range(7)],date(2026,9,9))),7)
        self.assertEqual(c.calls,2)
    def test_windows_and_zero_base(self):
        end=date(2026,9,8)
        points=[{'period':(end-timedelta(days=i)).isoformat(),'ratio':20 if i<30 else 10} for i in range(120)]
        self.assertEqual(trend_changes(points,end),{'trend_1m':100.0,'trend_3m':100.0,'trend_momentum':100.0,'seasonality':None})
        self.assertEqual(trend_changes([],end),{'trend_1m':None,'trend_3m':None,'trend_momentum':None,'seasonality':None})

    def test_sparse_datalab_days_still_produce_trends_with_sufficient_coverage(self):
        end=date(2026,9,8)
        points=[]
        for i in range(120):
            if i % 4:
                points.append({'period':(end-timedelta(days=i)).isoformat(),'ratio':20 if i<30 else 10})
        result=trend_changes(points,end)
        self.assertEqual(result['trend_1m'],100.0)
        self.assertEqual(result['trend_3m'],100.0)

    def test_web_result_count_uses_api_hub_and_returns_total(self):
        seen=[]
        def response(request):
            seen.append(request)
            return b'{"total":1234,"items":[]}'
        c=Client(dict(DEFAULT_CONFIG,request_interval=0),
                 env={'NAVER_API_HUB_CLIENT_ID':'test','NAVER_API_HUB_CLIENT_SECRET':'secret'},
                 transport=response,sleep=Mock())
        self.assertEqual(c.web_result_count('텐트 방수'),1234)
        self.assertIn('/search/v1/webkr?',seen[0].full_url)
        self.assertEqual(seen[0].get_header('X-ncp-apigw-api-key-id'),'test')

    def test_web_result_auth_failure_has_explicit_health(self):
        c=Client(dict(DEFAULT_CONFIG,request_interval=0),
                 env={'NAVER_API_HUB_CLIENT_ID':'test','NAVER_API_HUB_CLIENT_SECRET':'secret'},
                 transport=Mock(side_effect=HTTPError('https://x',401,'bad',{},None)),sleep=Mock())
        self.assertIsNone(c.web_result_count('텐트 방수'))
        self.assertEqual(c.health()['NAVER_WEB_SEARCH'],'AUTH_ERROR')
        self.assertEqual(c.health()['NAVER_WEB_SEARCH_PERMISSION'],'REQUIRED')

    def test_dedicated_web_api_hub_credentials_take_priority(self):
        seen=[]
        def response(request):
            seen.append(request)
            return b'{"total":10,"items":[]}'
        env={
            'NAVER_API_HUB_CLIENT_ID':'datalab-id',
            'NAVER_API_HUB_CLIENT_SECRET':'datalab-secret',
            'NAVER_WEB_SEARCH_API_HUB_CLIENT_ID':'web-id',
            'NAVER_WEB_SEARCH_API_HUB_CLIENT_SECRET':'web-secret',
        }
        c=Client(dict(DEFAULT_CONFIG,request_interval=0),env=env,transport=response)
        self.assertEqual(c.web_result_count('텐트'),10)
        self.assertEqual(seen[0].get_header('X-ncp-apigw-api-key-id'),'web-id')
    def test_missing_credentials(self):
        c=Client(DEFAULT_CONFIG,env={},transport=Mock())
        self.assertEqual(c.related('키워드'),[])
        self.assertEqual(c.calls,0)
        self.assertEqual(c.errors[0]['code'],'NAVER_SEARCH_ADS_NOT_CONFIGURED')

    def test_datalab_legacy_and_current_environment_names(self):
        env={'NAVER_CLIENT_ID':'id','NAVER_CLIENT_SECRET':'secret'}
        c=Client(dict(DEFAULT_CONFIG,request_interval=0),env=env,transport=Mock(return_value=b'{"results":[]}'))
        c.trends(['육아휴직'],date(2026,9,9))
        self.assertEqual(c.calls,1)

    def test_datalab_api_hub_credentials_use_api_hub_endpoint_and_headers(self):
        seen=[]
        def response(request):
            seen.append(request)
            return b'{"results":[]}'
        env={'NAVER_API_HUB_CLIENT_ID':'hub-id','NAVER_API_HUB_CLIENT_SECRET':'hub-secret'}
        c=Client(dict(DEFAULT_CONFIG,request_interval=0),env=env,transport=response)
        c.trends(['육아휴직'],date(2026,9,9))
        self.assertEqual(c.calls,1)
        self.assertEqual(seen[0].full_url,'https://naverapihub.apigw.ntruss.com/search-trend/v1/search')
        self.assertEqual(seen[0].get_header('X-ncp-apigw-api-key-id'),'hub-id')
        self.assertEqual(seen[0].get_header('X-ncp-apigw-api-key'),'hub-secret')

    def test_health_statuses(self):
        self.assertEqual(Client(DEFAULT_CONFIG,env={}).health()['NAVER_SEARCH_ADS'],'NOT_CONFIGURED')
        self.assertEqual(Client(DEFAULT_CONFIG,env={}).health()['NAVER_DATALAB'],'NOT_CONFIGURED')

    def test_auth_and_rate_limit_statuses(self):
        auth=self.client(Mock(side_effect=HTTPError('https://x',403,'bad',{},None)))
        auth.related('육아휴직')
        self.assertEqual(auth.health()['NAVER_SEARCH_ADS'],'AUTH_ERROR')
        limited=self.client(Mock(side_effect=HTTPError('https://x',429,'bad',{'Retry-After':'301'},None)))
        limited.related('육아휴직')
        self.assertEqual(limited.health()['NAVER_SEARCH_ADS'],'RATE_LIMITED')
        self.assertEqual(limited.calls,1)

    def test_datalab_auth_failure_status(self):
        c=self.client(Mock(side_effect=HTTPError('https://x',401,'bad',{},None)))
        self.assertEqual(c.trends(['육아휴직','키워드2','키워드3','키워드4','키워드5','키워드6'],date(2026,9,9)),{})
        self.assertEqual(c.health()['NAVER_DATALAB'],'AUTH_ERROR')
        self.assertEqual(c.calls,1)

    def test_retry_exhaustion_and_retry_after(self):
        c=self.client(Mock(side_effect=HTTPError('https://x',429,'bad',{'Retry-After':'4'},None)))
        self.assertEqual(c.related('텐트'),[])
        self.assertEqual(c.calls,4)
        self.assertEqual(c.errors[-1]['code'],'HTTP_429')
        self.assertTrue(all(x.args[0]>=30 for x in c.sleep.call_args_list))

    def test_malformed_response_isolated(self):
        c=self.client(Mock(side_effect=[b'not json',b'{"keywordList":[]}']))
        self.assertEqual(c.related('bad'),[])
        self.assertEqual(c.related('next'),[])
        self.assertEqual(c.errors[0]['code'],'INVALID_RESPONSE')

    def test_feed_external_discovery(self):
        c=self.client(Mock(return_value='<rss><channel><item><title>새 정책 신청 방법</title><link>https://example.com/new</link></item></channel></rss>'.encode()))
        rows=c.feed('https://example.com/rss')
        self.assertEqual(rows[0]['keyword'],'새 정책 신청 방법')
        self.assertEqual(rows[0]['source'],'PUBLIC_RSS')
