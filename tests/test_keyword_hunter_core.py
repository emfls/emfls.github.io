import unittest
from scripts import keyword_hunter_core as c

class CoreTests(unittest.TestCase):
    def test_dedupe_keywords_keeps_latest_best(self):
        rows=[{'keyword':'원천징수계산기','last_checked':'2026-09-12T01:00:00','confidence':'HIGH','opportunity_score':'70'}, {'keyword':'원천징수-계산기','last_checked':'2026-09-12T02:00:00','confidence':'MEDIUM','opportunity_score':'90'}]
        self.assertEqual(len(c.dedupe_keywords(rows)),1)
        self.assertEqual(c.dedupe_keywords(rows)[0]['opportunity_score'],'90')
    def test_normalization(self):
        self.assertEqual(c.normalize(' ＱＲ 코드!! '), c.normalize('qr코드'))
        self.assertEqual(c.normalize('팔월드'), c.normalize('팰월드'))
        self.assertNotEqual(c.normalize('2025 지원금'), c.normalize('2026 지원금'))

    def test_intent_duplicate(self):
        self.assertTrue(c.same_intent('팰월드 실행 오류 해결', '팔월드 실행 에러 해결방법'))
        self.assertFalse(c.same_intent('팰월드 낚시 방법', '팰월드 교배 방법'))
        self.assertFalse(c.same_intent('서울 캠핑 예약', '부산 캠핑 예약'))

    def test_score_missing_does_not_invent(self):
        empty = c.score({'keyword': '전기요금 계산 방법', 'category':'tools'}, c.DEFAULT_CONFIG)
        full = c.score({'keyword':'전기요금 계산 방법','category':'tools','monthly_total':10000,'competition':'낮음','trend_1m':30,'trend_3m':20},c.DEFAULT_CONFIG)
        self.assertEqual(empty['confidence'], 'UNVERIFIED')
        self.assertEqual(empty['data_coverage'], 0)
        self.assertFalse(empty['score_valid'])
        self.assertIsNone(empty['opportunity_score'])
        self.assertEqual(full['confidence'], 'MEDIUM')
        self.assertEqual(full['data_coverage'], 80)
        self.assertTrue(full['score_valid'])
        self.assertLessEqual(full['opportunity_score'],100)
        high = c.score({'keyword':'전기요금 계산 방법','category':'tools','monthly_total':10000,'competition':'높음','trend_1m':30,'trend_3m':20},c.DEFAULT_CONFIG)
        self.assertLess(high['opportunity_score'],full['opportunity_score'])

    def test_partial_api_confidence(self):
        ads = c.score({'keyword':'육아휴직 조건','category':'gov','monthly_total':500,'competition':'LOW'}, c.DEFAULT_CONFIG)
        trend = c.score({'keyword':'육아휴직 조건','category':'gov','trend_1m':10,'trend_3m':20}, c.DEFAULT_CONFIG)
        medium = c.score({'keyword':'육아휴직 조건','category':'gov','monthly_total':500,
                          'competition':'LOW','trend_1m':10,'trend_3m':20}, c.DEFAULT_CONFIG)
        self.assertEqual(ads['confidence'], 'LOW')
        self.assertEqual(trend['confidence'], 'UNVERIFIED')
        self.assertFalse(ads['score_valid'])
        self.assertFalse(trend['score_valid'])
        self.assertEqual(medium['confidence'], 'MEDIUM')
        self.assertTrue(medium['score_valid'])

    def test_web_result_upgrades_confidence_but_is_not_required_for_valid_score(self):
        medium = c.score({'keyword':'명확한 검색 의도','category':'tools','monthly_total':500,
                          'trend_1m':10}, c.DEFAULT_CONFIG)
        high = c.score({'keyword':'명확한 검색 의도','category':'tools','monthly_total':500,
                        'trend_1m':10,'web_result_count':1000}, c.DEFAULT_CONFIG)
        self.assertTrue(medium['score_valid'])
        self.assertEqual(medium['confidence'],'MEDIUM')
        self.assertEqual(high['confidence'],'HIGH')
        self.assertNotIn('competition_missing',medium['score_invalid_reasons'])

    def test_invalid_score_records_exact_missing_reasons(self):
        result=c.score({'keyword':'검증 필요 후보','category':'tools','competition':'LOW'},c.DEFAULT_CONFIG)
        self.assertFalse(result['score_valid'])
        self.assertEqual(set(result['score_invalid_reasons'].split('|')),
                         {'monthly_volume_missing','trend_missing','web_result_missing'})

    def test_status_transition(self):
        row={'status':'NEW','score_valid':True}
        for status in ['REVIEWED','QUEUED','PUBLISHED']:
            c.transition(row,status)
        with self.assertRaises(ValueError): c.transition(row,'NEW')
        with self.assertRaises(ValueError): c.transition({'status':'NEW'},'PUBLISHED')

    def test_unverified_cannot_enter_content_queue(self):
        with self.assertRaises(ValueError):
            c.transition({'status':'REVIEWED','confidence':'UNVERIFIED','score_valid':False},'QUEUED')

    def test_allocation(self):
        self.assertEqual(c.allocate(200,c.DEFAULT_CONFIG['exploration']),{'longtail':120,'discovery':50,'trend':30})

    def test_tags(self):
        self.assertIn('troubleshooting',c.tags('윈도우 실행 오류 해결'))
        self.assertIn('calculator/tool',c.tags('전기요금 계산기'))
        self.assertIn('comparison',c.tags('텐트 비교'))

    def test_volume_censored(self):
        self.assertIsNone(c.volume('< 10'))
        self.assertEqual(c.volume('0'),0)

    def test_zero_quota_returns_nothing(self):
        self.assertEqual(c.diverse([{'category':'camp'}],0,.25),[])
