from scripts.safe_auto_publish import resolve_family, eligibility, generate_page, percentage_of, percentage_ratio, percentage_change, validate_generated_page

def candidate(keyword, **kw):
    d={'keyword':keyword,'score_valid':'True','review_status':'PAGE_REVIEW_READY','overlap':'NO_OVERLAP','suggested_url':'/kor/util/x/','status':'NEW','action':'NEW_PAGE'}; d.update(kw); return d

def test_percentage_calculator_is_safe_family():
    r=eligibility(candidate('퍼센트계산기', content_types='calculator/tool'), set(), set(), 0, 1, True)
    assert r['status']=='SAFE_AUTO_ELIGIBLE' and r['family_id']=='percentage_calculator'
    assert percentage_of(200,15)==30 and percentage_of(12.5,8)==1
    assert percentage_ratio(30,200)==15
    assert percentage_change(100,10,'increase')==110 and percentage_change(100,10,'decrease')==90
    assert percentage_ratio(0,0) is None

def test_generic_and_ymyl_candidates_are_not_safe():
    assert eligibility(candidate('영어추천', content_types='informational'),set(),set(),0,1,True)['status']=='PAGE_REVIEW_READY'
    assert eligibility(candidate('세금계산기', content_types='calculator/tool'),set(),set(),0,1,True)['status']=='BLOCKED'

def test_duplicate_hold_and_limit_block():
    assert eligibility(candidate('퍼센트계산기'), {'/kor/util/x/'}, set(),0,1,True)['status']=='BLOCKED'
    assert eligibility(candidate('퍼센트계산기'), set(), {'퍼센트계산기'},0,1,True)['status']=='BLOCKED'
    assert eligibility(candidate('퍼센트계산기'), set(), set(),1,1,True)['status']=='BLOCKED'

def test_generator_is_deterministic_and_handles_invalid_input():
    html=generate_page(candidate('퍼센트계산기'))
    assert html == generate_page(candidate('퍼센트계산기'))
    assert validate_generated_page(html) and '퍼센트 계산기' in html and '오류' in html

def test_resolver_is_strict_and_escapes_html():
    for k in ['세금 퍼센트 계산기','대출 비율 계산기','투자 수익률 계산기','보험료 비율 계산기','BMI 퍼센트 계산기','퇴직금 비율 계산기','급여 인상률 계산기','할인율 추천','퍼센트 추천']:
        assert resolve_family(k) is None
    assert '&lt;' in generate_page(candidate('<퍼센트계산기>'))
