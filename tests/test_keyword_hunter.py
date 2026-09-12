import csv
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock
from scripts import keyword_hunter as h
from scripts.keyword_hunter_site import inventory, SiteIndex

class HunterTests(unittest.TestCase):
    def test_csv_state_uses_repository_lf_line_endings(self):
        from scripts.keyword_hunter_state import csv_text
        text = csv_text([{"keyword": "테스트", "status": "NEW"}])
        self.assertNotIn("\r\n", text)

    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name); (self.root/'data').mkdir()
        (self.root/'PROJECT_HISTORY.md').write_text('# Prior history\n')
        (self.root/'data/keyword_seeds.json').write_text(json.dumps({'seeds':[{'keyword':'텐트','category':'camp','strategy':'longtail','depth':0}]}))
    def test_load_env_file_sets_missing_values_without_overwriting_process_environment(self):
        (self.root/'.env').write_text('NAVER_API_HUB_CLIENT_ID=file-id\nNAVER_API_HUB_CLIENT_SECRET=file-secret\n',encoding='utf-8')
        env={'NAVER_API_HUB_CLIENT_ID':'process-id'}
        h.load_env_file(self.root,env)
        self.assertEqual(env['NAVER_API_HUB_CLIENT_ID'],'process-id')
        self.assertEqual(env['NAVER_API_HUB_CLIENT_SECRET'],'file-secret')
    def test_site_heading_and_metadata(self):
        (self.root/'index.html').write_text('<title>팰월드 공략</title><h2>팰월드 실행 에러 해결방법</h2>')
        pages=inventory(self.root)
        self.assertIn('팰월드 실행 에러 해결방법',pages[0]['headings'])
        overlap=SiteIndex(pages).match('팔월드 실행 오류 해결')
        self.assertEqual(overlap['decision'],'IMPROVE_EXISTING')
    def test_dry_run_no_writes_no_network(self):
        before={str(p):p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        result=h.run(self.root,dry_run=True,run_at='2026-09-09T18:00:00+09:00')
        after={str(p):p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        self.assertEqual(before,after)
        self.assertEqual(result['api_calls'],0)
    def test_persistence_report_repeat(self):
        client=Mock(errors=[],rate_limits=0,calls=1)
        client.feed.return_value=[]
        client.related.return_value=[{'keyword':'텐트 방수 코팅 방법','monthly_total':300,'monthly_pc':100,'monthly_mobile':200,'competition':'낮음','source':'NAVER_SEARCHAD'}]
        client.trends.return_value={}
        first=h.run(self.root,client=client,run_at='2026-09-09T18:00:00+09:00')
        self.assertEqual(first['new_keywords'],1)
        second=h.run(self.root,client=client,run_at='2026-09-09T20:00:00+09:00')
        self.assertEqual(second['new_keywords'],0)
        with (self.root/'data/keywords_master.csv').open() as stream:
            rows=list(csv.DictReader(stream))
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['parent_keyword'],'텐트')
        self.assertIn('TOP 5',(self.root/'reports/keyword-hunter/2026-09-09-1800.md').read_text())
        self.assertIn('Prior history',(self.root/'PROJECT_HISTORY.md').read_text())
        for name in ['keyword_seeds','keyword_clusters','rejected_keywords','published_keywords']:
            self.assertTrue((self.root/('data/'+name+'.json')).exists())
    def test_site_duplicate_not_top(self):
        (self.root/'index.html').write_text('<title>텐트 방수 코팅 방법</title>')
        client=Mock(errors=[],rate_limits=0,calls=0)
        client.feed.return_value=[];client.trends.return_value={}
        client.related.return_value=[{'keyword':'텐트 방수 코팅 방법','source':'NAVER_SEARCHAD'}]
        result=h.run(self.root,client=client,run_at='2026-09-09T18:00:00+09:00')
        self.assertEqual(result['top50'],[])
        self.assertEqual(result['updates'][0]['action'],'IMPROVE_EXISTING')
    def test_corrupt_db_preserved(self):
        path=self.root/'data/keyword_seeds.json';path.write_text('broken')
        with self.assertRaises(ValueError): h.run(self.root,offline=True)
        self.assertEqual(path.read_text(),'broken')
    def test_category_budget_and_depth(self):
        rows=[{'keyword':str(i),'category':'camp'} for i in range(100)]
        self.assertLessEqual(len(h.diverse(rows,20,.25)),5)
        seeds=[{'keyword':'deep','depth':4,'strategy':'longtail','category':'camp'}]
        self.assertEqual(h.choose_seeds(seeds,[],h.DEFAULT_CONFIG),[])

    def test_recovery_completes_interrupted_transaction(self):
        from scripts.keyword_hunter_state import recover
        folder=self.root/'.keyword-hunter';folder.mkdir()
        (folder/'transaction.json').write_text(json.dumps({'data/recovered.json':'{"ok":true}'}))
        recover(self.root)
        self.assertEqual(json.loads((self.root/'data/recovered.json').read_text()),{'ok':True})
        self.assertFalse((folder/'transaction.json').exists())

    def test_lock_prevents_concurrent_run(self):
        from scripts.keyword_hunter_state import locked
        with locked(self.root):
            with self.assertRaises(ValueError):
                with locked(self.root): pass

    def test_top50_20_5_and_breadth_caps_with_200_candidates(self):
        seeds=[]
        for strategy in ['longtail','discovery','trend']:
            for cat in ['camp','tools','travel','gov']:
                seeds.append({'keyword':strategy+cat,'strategy':strategy,'category':cat,'depth':0})
        (self.root/'data/keyword_seeds.json').write_text(json.dumps({'seeds':seeds}))
        client=Mock(errors=[],rate_limits=0,calls=0)
        client.feed.return_value=[];client.trends.return_value={}
        def related(seed):
            return [{'keyword':seed+' '+str(i)+' 비용 계산 방법','source':'NAVER_SEARCHAD','monthly_total':10000,'competition':'낮음'} for i in range(50)]
        client.related.side_effect=related
        client.trends.side_effect=lambda keywords, _: {k:{'trend_1m':10,'trend_3m':20} for k in keywords}
        result=h.run(self.root,client=client,run_at='2026-09-09T18:00:00+09:00')
        self.assertEqual(sum(result['strategy_counts'].values()),160)
        self.assertEqual(result['shortfall'],40)
        self.assertEqual([len(result[k]) for k in ['top50','top20','top5']],[40,16,4])
        with (self.root/'data/keywords_master.csv').open() as stream:
            rows=list(csv.DictReader(stream))
        self.assertLessEqual(max(sum(r['category']==cat for r in rows) for cat in {r['category'] for r in rows}),40)
        self.assertLessEqual(max(sum(r['cluster']==cluster for r in rows) for cluster in {r['cluster'] for r in rows}),20)

    def test_unverified_candidates_are_capped_and_never_ranked(self):
        client=Mock(errors=[],rate_limits=0,calls=0)
        client.health.return_value={'NAVER_SEARCH_ADS':'NOT_CONFIGURED','NAVER_DATALAB':'NOT_CONFIGURED','EXTERNAL_RSS':'DEGRADED'}
        client.feed.return_value=[{'keyword':'외부 후보 '+str(i),'source':'PUBLIC_RSS'} for i in range(40)]
        client.related.return_value=[]; client.trends.return_value={}
        result=h.run(self.root,client=client,run_at='2026-09-09T18:00:00+09:00')
        self.assertLessEqual(result['db_total'],20)
        self.assertEqual(result['top5'],[])
        with (self.root/'data/keywords_master.csv').open() as stream:
            rows=list(csv.DictReader(stream))
        self.assertTrue(all(r['confidence']=='UNVERIFIED' and r['score_valid']=='False' and r['opportunity_score']=='' for r in rows))

    def test_existing_unverified_rows_are_revalidated_when_apis_recover(self):
        client=Mock(errors=[],rate_limits=0,calls=0)
        client.health.return_value={'NAVER_SEARCH_ADS':'NOT_CONFIGURED','NAVER_DATALAB':'NOT_CONFIGURED','EXTERNAL_RSS':'DEGRADED'}
        client.feed.return_value=[{'keyword':'텐트 방수 방법','source':'PUBLIC_RSS'}]
        client.related.return_value=[]; client.trends.return_value={}
        h.run(self.root,client=client,run_at='2026-09-09T18:00:00+09:00')
        healthy=Mock(errors=[],rate_limits=0,calls=2)
        healthy.health.return_value={'NAVER_SEARCH_ADS':'OK','NAVER_DATALAB':'OK','EXTERNAL_RSS':'DEGRADED'}
        healthy.feed.return_value=[]
        healthy.related.return_value=[{'keyword':'텐트 방수 방법','monthly_pc':100,'monthly_mobile':200,'monthly_total':300,'competition':'LOW','source':'NAVER_SEARCHAD'}]
        healthy.trends.return_value={'텐트 방수 방법':{'trend_1m':10,'trend_3m':20}}
        h.run(self.root,client=healthy,run_at='2026-09-10T18:00:00+09:00')
        with (self.root/'data/keywords_master.csv').open() as stream:
            row=list(csv.DictReader(stream))[0]
        self.assertEqual(row['confidence'],'MEDIUM')
        self.assertEqual(row['score_valid'],'True')

    def test_health_check_reports_site_and_optional_rss(self):
        (self.root/'index.html').write_text('<title>Site</title>')
        client=Mock()
        client.health.return_value={'NAVER_SEARCH_ADS':'OK','NAVER_DATALAB':'OK','EXTERNAL_RSS':'DEGRADED'}
        result=h.health_check(self.root,client)
        self.assertEqual(result['SITE_INDEX'],'OK')
        self.assertEqual(result['EXTERNAL_RSS'],'DEGRADED')

    def test_rss_failure_does_not_stop_core_sources(self):
        client=Mock(errors=[{'source':'PUBLIC_RSS','seed':'rss','code':'NETWORK_ERROR'}],rate_limits=0,calls=2)
        client.health.return_value={'NAVER_SEARCH_ADS':'OK','NAVER_DATALAB':'OK','EXTERNAL_RSS':'DEGRADED'}
        client.feed.return_value=[]
        client.related.return_value=[{'keyword':'텐트 방수 방법','monthly_pc':100,'monthly_mobile':200,'monthly_total':300,'competition':'LOW','source':'NAVER_SEARCHAD'}]
        client.trends.side_effect=lambda keywords, _: {k:{'trend_1m':10,'trend_3m':20} for k in keywords}
        result=h.run(self.root,client=client,run_at='2026-09-09T18:00:00+09:00')
        self.assertEqual(result['new_keywords'],1)
        self.assertEqual(result['api_health']['EXTERNAL_RSS'],'DEGRADED')
        self.assertTrue(result['top5'])

    def test_data_quality_only_migrates_without_discovery(self):
        client=Mock(errors=[],rate_limits=0,calls=0)
        client.health.return_value={'NAVER_SEARCH_ADS':'NOT_CONFIGURED','NAVER_DATALAB':'NOT_CONFIGURED','EXTERNAL_RSS':'DEGRADED'}
        client.feed.return_value=[{'keyword':'새 후보','source':'PUBLIC_RSS'}]
        client.related.return_value=[]; client.trends.return_value={}
        h.run(self.root,client=client,run_at='2026-09-09T18:00:00+09:00')
        before=json.loads((self.root/'data/keyword_seeds.json').read_text())
        result=h.run(self.root,client=client,run_at='2026-09-09T19:00:00+09:00',data_quality_only=True)
        after=json.loads((self.root/'data/keyword_seeds.json').read_text())
        self.assertEqual(result['new_keywords'],0)
        self.assertEqual(before,after)
        client.feed.assert_called_once()

    def test_production_run_stops_search_ads_after_auth_failure(self):
        (self.root/'data/keyword_seeds.json').write_text(json.dumps({'seeds':[
            {'keyword':'첫 seed','category':'camp','strategy':'longtail','depth':0},
            {'keyword':'둘째 seed','category':'tools','strategy':'longtail','depth':0},
        ]}))
        state={'NAVER_SEARCH_ADS':'API_ERROR','NAVER_DATALAB':'NOT_CONFIGURED','EXTERNAL_RSS':'DEGRADED'}
        client=Mock(errors=[],rate_limits=0,calls=1)
        client.health.side_effect=lambda: dict(state)
        client.feed.return_value=[]; client.trends.return_value={}
        def fail_auth(_):
            state['NAVER_SEARCH_ADS']='AUTH_ERROR'
            return []
        client.related.side_effect=fail_auth
        h.run(self.root,client=client,run_at='2026-09-09T18:00:00+09:00')
        self.assertEqual(client.related.call_count,1)

    def test_failed_search_ads_attempt_does_not_mark_seed_expanded(self):
        state={'NAVER_SEARCH_ADS':'API_ERROR','NAVER_DATALAB':'NOT_CONFIGURED','EXTERNAL_RSS':'DEGRADED'}
        client=Mock(errors=[],rate_limits=0,calls=1)
        client.health.side_effect=lambda: dict(state)
        client.feed.return_value=[]; client.trends.return_value={}
        def fail(_):
            state['NAVER_SEARCH_ADS']='AUTH_ERROR'
            return []
        client.related.side_effect=fail
        h.run(self.root,client=client,run_at='2026-09-09T18:00:00+09:00')
        seed=json.loads((self.root/'data/keyword_seeds.json').read_text())['seeds'][0]
        self.assertNotIn('last_expanded',seed)

    def test_next_seeds_exclude_successfully_cached_seed(self):
        client=Mock(errors=[],rate_limits=0,calls=1)
        client.health.return_value={'NAVER_SEARCH_ADS':'OK','NAVER_DATALAB':'NOT_CONFIGURED','EXTERNAL_RSS':'DEGRADED'}
        client.feed.return_value=[]; client.trends.return_value={}
        client.related.return_value=[]
        result=h.run(self.root,client=client,run_at='2026-09-09T18:00:00+09:00')
        self.assertNotIn('텐트',result['next_seeds'])

    def test_autonomous_exploration_excludes_anchored_seed_and_reports_metrics(self):
        (self.root/'data/keyword_seeds.json').write_text(json.dumps({'seeds':[
            {'keyword':'설명용 예시','category':'example','strategy':'longtail','depth':0,'source':'INITIAL_SITE_FIT'},
            {'keyword':'새로운 관찰 주제','category':'new-area','strategy':'discovery','depth':0,'source':'PUBLIC_RSS'},
        ]}))
        client=Mock(errors=[],rate_limits=0,calls=2)
        client.health.return_value={'NAVER_SEARCH_ADS':'OK','NAVER_DATALAB':'OK','EXTERNAL_RSS':'OK'}
        client.feed.return_value=[]
        client.related.return_value=[{'keyword':'새로운 관찰 주제 가격','monthly_pc':100,'monthly_mobile':200,'monthly_total':300,'competition':'LOW','source':'NAVER_SEARCHAD'}]
        client.trends.side_effect=lambda keywords,_:{k:{'trend_1m':10,'trend_3m':20} for k in keywords}
        result=h.run(self.root,client=client,run_at='2026-09-10T18:00:00+09:00')
        called=[c.args[0] for c in client.related.call_args_list]
        self.assertNotIn('설명용 예시',called)
        self.assertIn('새로운 관찰 주제',called)
        for key in ('exploration_candidates','new_seed_count','repeated_seed_count','recent_seed_overlap',
                    'new_category_count','new_cluster_count','novelty_ratio','category_shares','source_shares',
                    'winner_count','new_theme_winners','cooldown_clusters','next_exploration_directions','random_seed',
                    'datalab_monthly_limit','datalab_used_this_month','datalab_remaining_quota',
                    'datalab_remaining_days','datalab_daily_budget','datalab_run_budget','datalab_actual_calls',
                    'datalab_validated_keywords','datalab_average_keywords_per_call'):
            self.assertIn(key,result)
            self.assertIn(key,result['report_text'])
        history=json.loads((self.root/'data/recent_exploration_history.json').read_text())
        self.assertEqual(len(history['runs']),1)

    def test_report_contains_discovery_funnel_and_candidate_fallback(self):
        (self.root/'data/recent_exploration_history.json').write_text(json.dumps({'runs':[{'keywords':[],'winners':[]} for _ in range(3)]}))
        client=Mock(errors=[],rate_limits=0,calls=2,datalab_calls=1,datalab_keywords_validated=1)
        client.health.return_value={'NAVER_SEARCH_ADS':'OK','NAVER_DATALAB':'OK','EXTERNAL_RSS':'OK'}
        client.feed.return_value=[]
        client.related.return_value=[{'keyword':'새 관찰 문제 해결','monthly_pc':100,'monthly_mobile':200,'monthly_total':300,'competition':'LOW','source':'NAVER_SEARCHAD'}]
        client.trends.side_effect=lambda keywords,_:{k:{'trend_1m':10,'trend_3m':20} for k in keywords}
        result=h.run(self.root,client=client,run_at='2026-09-11T20:00:00+09:00')
        for key in ('seeds_considered','cooldown_excluded','seeds_queried','raw_keywords','normalized_keywords',
                    'db_duplicates_removed','category_saturation_excluded','novelty_excluded','fast_filter_entered',
                    'fast_filter_passed','naver_web_result_count_calls','datalab_verified','score_valid_count',
                    'winner_threshold_excluded','candidate_count','winner_count'):
            self.assertIn(key,result['discovery_funnel'])
            self.assertIn(key,result['report_text'])
        self.assertTrue(result['zero_result_recovery'])
        self.assertIn('## CANDIDATE 10',result['report_text'])

    def test_anchor_exclusion_blocks_search_ads_descendant_by_master_lineage(self):
        (self.root/'data/seed_exclusions.json').write_text(json.dumps({'roots':['설명용 뿌리']}))
        (self.root/'data/keyword_seeds.json').write_text(json.dumps({'seeds':[
            {'keyword':'2세대 파생 후보','category':'example','cluster':'2세대파생후보','strategy':'longtail','depth':2,'source':'NAVER_SEARCHAD'}]}))
        from scripts.keyword_hunter_state import csv_text
        (self.root/'data/keywords_master.csv').write_text(csv_text([
            {'keyword':'1세대 파생','parent_keyword':'설명용 뿌리','cluster':'1세대파생','category':'example','status':'NEW','source':'NAVER_SEARCHAD','depth':1},
            {'keyword':'2세대 파생 후보','parent_keyword':'1세대 파생','cluster':'2세대파생후보','category':'example','status':'NEW','source':'NAVER_SEARCHAD','depth':2},
        ]),encoding='utf-8')
        client=Mock(errors=[],rate_limits=0,calls=0)
        client.health.return_value={'NAVER_SEARCH_ADS':'OK','NAVER_DATALAB':'NOT_CONFIGURED','EXTERNAL_RSS':'DEGRADED'}
        client.feed.return_value=[];client.related.return_value=[];client.trends.return_value={}
        h.run(self.root,client=client,run_at='2026-09-10T18:00:00+09:00')
        self.assertNotIn('2세대 파생 후보',[c.args[0] for c in client.related.call_args_list])

    def test_new_measured_candidates_are_prioritized_for_datalab(self):
        old=[{'keyword':'오래된 미검증','monthly_total':'','opportunity_score':''}]
        fresh=[{'keyword':'신규 고수요','monthly_total':5000,'opportunity_score':''}]
        ordered=h.prioritize_trend_rows(old+fresh,fresh)
        self.assertEqual(ordered[0]['keyword'],'신규 고수요')

    def test_fast_filter_skips_recent_validation_and_only_relaxes_in_recovery(self):
        from datetime import datetime, timezone
        now=datetime(2026,9,11,20,0,tzinfo=timezone.utc)
        rows=[{'keyword':'recent','monthly_total':100,'competition':'LOW','trend_1m':1,'trend_3m':2,'datalab_checked_at':'2026-09-11T19:30:00+00:00'},
              {'keyword':'low','monthly_total':6,'competition':'LOW','datalab_checked_at':''},
              {'keyword':'normal','monthly_total':20,'competition':'LOW','datalab_checked_at':''}]
        _,normal=h.fast_filter_rows(rows,[],now,h.DEFAULT_CONFIG,recovery=False)
        _,recovery=h.fast_filter_rows(rows,[],now,h.DEFAULT_CONFIG,recovery=True)
        self.assertEqual([r['keyword'] for r in normal],['normal'])
        self.assertEqual({r['keyword'] for r in recovery},{'low','normal'})

    def test_fast_filter_rechecks_recent_row_when_trend_data_is_missing(self):
        from datetime import datetime, timezone
        now=datetime(2026,9,11,20,0,tzinfo=timezone.utc)
        row={'keyword':'missing trend','monthly_total':100,'competition':'LOW',
             'datalab_checked_at':'2026-09-11T19:30:00+00:00','trend_1m':'','trend_3m':''}
        _,passed=h.fast_filter_rows([row],[],now,h.DEFAULT_CONFIG)
        self.assertEqual(passed,[row])

    def test_pending_validation_prioritizes_measured_commercial_rows_and_expires_retries(self):
        from datetime import datetime, timezone
        now=datetime(2026,9,12,12,0,tzinfo=timezone.utc)
        rows=[
            {'keyword':'정수기가격비교','monthly_total':350,'competition':'HIGH','commercial_intent':.9,
             'opportunity_score':39.1,'trend_1m':-37.75,'trend_3m':-43.21,'web_result_count':'',
             'pending_retry_count':1,'pending_last_attempt_at':'2026-09-11T12:00:00+00:00','status':'NEW'},
            {'keyword':'저수요','monthly_total':20,'competition':'LOW','commercial_intent':.3,
             'trend_1m':'','web_result_count':'','pending_retry_count':0,'status':'NEW'},
            {'keyword':'만료','monthly_total':500,'competition':'LOW','commercial_intent':.9,
             'trend_1m':'','web_result_count':'','pending_retry_count':3,'status':'NEW'},
        ]
        pending,expired=h.pending_validation_rows(rows,now,{**h.DEFAULT_CONFIG,'pending_validation_max_retries':3})
        self.assertEqual([row['keyword'] for row in pending],['정수기가격비교','저수요'])
        self.assertEqual([row['keyword'] for row in expired],['만료'])
        self.assertEqual(pending[0]['pending_validation'],'True')

    def test_pending_validation_clears_after_latest_measurements_are_present(self):
        row={'keyword':'정수기가격비교','monthly_total':350,'competition':'HIGH',
             'trend_1m':-37.75,'trend_3m':-43.21,'web_result_count':1000,
             'pending_validation':'True','pending_retry_count':2,'pending_last_attempt_at':'2026-09-11T12:00:00+00:00'}
        self.assertTrue(h.clear_pending_validation_if_complete(row))
        self.assertEqual(row['pending_validation'],'False')
        self.assertEqual(row['pending_retry_count'],0)

    def test_unsubmitted_row_keeps_existing_trend_data(self):
        from scripts.keyword_hunter_state import csv_text
        (self.root/'data/recent_exploration_history.json').write_text(json.dumps({'runs':[{'keywords':[],'winners':[]} for _ in range(3)]}))
        existing={'keyword':'검증 완료 후보','cluster':'검증완료','category':'test','monthly_pc':100,'monthly_mobile':200,
                  'monthly_total':300,'competition':'LOW','trend_1m':10,'trend_3m':20,'status':'NEW','action':'NEW_PAGE',
                  'source':'NAVER_SEARCHAD','depth':1,'datalab_checked_at':'2026-09-11T19:30:00+09:00'}
        (self.root/'data/keywords_master.csv').write_text(csv_text([existing]))
        client=Mock(errors=[],rate_limits=0,calls=0,datalab_calls=0,datalab_keywords_validated=0)
        client.health.return_value={'NAVER_SEARCH_ADS':'OK','NAVER_DATALAB':'OK','EXTERNAL_RSS':'OK'}
        client.feed.return_value=[];client.related.return_value=[];client.trends.return_value={}
        h.run(self.root,client=client,run_at='2026-09-11T20:00:00+09:00')
        with (self.root/'data/keywords_master.csv').open() as stream: row=list(csv.DictReader(stream))[0]
        self.assertEqual(row['trend_1m'],'10')
        self.assertEqual(row['trend_3m'],'20')

    def test_validation_merges_preserve_search_ads_metrics_through_database(self):
        client=Mock(errors=[],rate_limits=0,calls=3,datalab_calls=1,
                    datalab_keywords_validated=1,web_result_calls=1)
        client.health.return_value={'NAVER_SEARCH_ADS':'OK','NAVER_DATALAB':'OK',
                                    'NAVER_WEB_SEARCH':'OK','EXTERNAL_RSS':'OK'}
        client.feed.return_value=[]
        client.related.return_value=[{'keyword':'텐트 방수 코팅 비용 비교 가이드','monthly_pc':120,
                                     'monthly_mobile':380,'monthly_total':500,
                                     'competition':'LOW','source':'NAVER_SEARCHAD',
                                     'source_seed':'텐트'}]
        client.web_result_count.return_value=2500
        client.trends.side_effect=lambda keywords,_:{k:{'trend_1m':10,'trend_3m':20} for k in keywords}
        result=h.run(self.root,client=client,run_at='2026-09-11T20:00:00+09:00')
        with (self.root/'data/keywords_master.csv').open() as stream:
            row=list(csv.DictReader(stream))[0]
        self.assertEqual((row['monthly_pc'],row['monthly_mobile'],row['monthly_total']),('120','380','500'))
        self.assertEqual(row['source_seed'],'텐트')
        self.assertEqual(row['web_result_count'],'2500')
        self.assertEqual(row['confidence'],'HIGH')
        self.assertEqual(row['score_valid'],'True')
        self.assertEqual(result['discovery_funnel']['naver_web_result_count_calls'],1)

    def test_non_destructive_merge_keeps_volume_when_deep_validation_is_partial(self):
        row={'monthly_pc':100,'monthly_mobile':200,'monthly_total':300,'competition':'LOW'}
        h.merge_validation_data(row,{'trend_1m':12,'monthly_total':None})
        h.merge_validation_data(row,{'web_result_count':900,'competition':None})
        self.assertEqual(row['monthly_total'],300)
        self.assertEqual(row['competition'],'LOW')
        self.assertEqual(row['trend_1m'],12)
        self.assertEqual(row['web_result_count'],900)

    def test_status_command_persists_registry(self):
        client=Mock(errors=[],rate_limits=0,calls=0)
        client.feed.return_value=[];client.trends.return_value={}
        client.related.return_value=[{'keyword':'텐트 방수 코팅 방법','source':'NAVER_SEARCHAD'}]
        h.run(self.root,client=client)
        h.run(self.root,offline=True,status_change=('텐트 방수 코팅 방법','REJECTED',None))
        rejected=json.loads((self.root/'data/rejected_keywords.json').read_text())
        self.assertEqual(rejected[0]['keyword'],'텐트 방수 코팅 방법')

    def test_rejected_seed_not_expanded(self):
        seeds=[{'keyword':'bad','depth':0,'strategy':'longtail','category':'camp'}]
        self.assertEqual(h.choose_seeds(seeds,[{'keyword':'bad','status':'REJECTED'}],h.DEFAULT_CONFIG),[])

    def test_published_url_retained(self):
        client=Mock(errors=[],rate_limits=0,calls=0)
        client.feed.return_value=[]
        client.trends.return_value={'텐트 방수 코팅 방법':{'trend_1m':10,'trend_3m':20}}
        client.related.return_value=[{'keyword':'텐트 방수 코팅 방법','monthly_pc':100,'monthly_mobile':200,'monthly_total':300,'competition':'LOW','source':'NAVER_SEARCHAD'}]
        h.run(self.root,client=client)
        for status in ['REVIEWED','QUEUED']:
            h.run(self.root,offline=True,status_change=('텐트 방수 코팅 방법',status,None))
        (self.root/'new.html').write_text('<title>제품 관리 안내</title>')
        h.run(self.root,offline=True,status_change=('텐트 방수 코팅 방법','PUBLISHED','/new.html'))
        row=json.loads((self.root/'data/published_keywords.json').read_text())[0]
        self.assertEqual(row['url'],'/new.html')
