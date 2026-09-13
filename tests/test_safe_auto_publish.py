from scripts.safe_auto_publish import resolve_family, eligibility, generate_page

def candidate(keyword, **kw):
    d={'keyword':keyword,'score_valid':'True','review_status':'PAGE_REVIEW_READY','overlap':'NO_OVERLAP','suggested_url':'/kor/util/x/','status':'NEW','action':'NEW_PAGE'}; d.update(kw); return d

def test_percentage_calculator_is_safe_family():
    r=eligibility(candidate('퍼센트계산기', content_types='calculator/tool'), set(), set(), 0, 1)
    assert r['status']=='SAFE_AUTO_ELIGIBLE' and r['family_id']=='percentage_calculator'

def test_generic_and_ymyl_candidates_are_not_safe():
    assert eligibility(candidate('영어추천', content_types='informational'),set(),set(),0,1)['status']=='PAGE_REVIEW_READY'
    assert eligibility(candidate('세금계산기', content_types='calculator/tool'),set(),set(),0,1)['status']=='BLOCKED'

def test_duplicate_hold_and_limit_block():
    assert eligibility(candidate('퍼센트계산기'), {'/kor/util/x/'}, set(),0,1)['status']=='BLOCKED'
    assert eligibility(candidate('퍼센트계산기'), set(), {'퍼센트계산기'},0,1)['status']=='BLOCKED'
    assert eligibility(candidate('퍼센트계산기'), set(), set(),1,1)['status']=='BLOCKED'

def test_generator_is_deterministic_and_handles_invalid_input():
    html=generate_page(candidate('퍼센트계산기'))
    assert html == generate_page(candidate('퍼센트계산기'))
    assert '퍼센트 계산기' in html and '계산' in html and '오류' in html
