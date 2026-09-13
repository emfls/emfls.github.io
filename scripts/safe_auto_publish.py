"""Fail-closed SAFE_AUTO foundation; no production writes are performed."""
import re
from .content_launch_policy import normalize_keyword

FAMILIES={
 'percentage_calculator': {'patterns':('퍼센트계산기','비율계산기','percentage calculator','ratio calculator'),'blocked':('세금','급여','대출','투자','보험','의료','bmi')},
 'unit_converter': {'patterns':('단위계산기','단위변환','unit converter'),'blocked':()},
 'text_counter': {'patterns':('글자수계산기','문자수계산기','text counter'),'blocked':()},
 'date_arithmetic': {'patterns':('날짜계산기','날짜계산','date calculator'),'blocked':()},
}

def resolve_family(keyword):
    text=str(keyword or '').casefold()
    for family,spec in FAMILIES.items():
        if any(p.casefold() in text for p in spec['patterns']) and not any(b.casefold() in text for b in spec['blocked']): return family
    return None

def eligibility(candidate, existing_urls, published_keywords, launched_count, daily_limit):
    row=dict(candidate); reason=''
    family=resolve_family(row.get('keyword'))
    if int(launched_count)>=int(daily_limit): status='BLOCKED'; reason='daily_limit'
    elif str(row.get('score_valid')).casefold() not in {'true','1','yes'}: status='BLOCKED'; reason='invalid_score'
    elif row.get('status') in {'PUBLISHED','REJECTED','COOLDOWN','EXPIRED'}: status='BLOCKED'; reason='ineligible'
    elif row.get('action','NEW_PAGE')!='NEW_PAGE': status='BLOCKED'; reason='not_new_page'
    elif row.get('overlap','NO_OVERLAP')!='NO_OVERLAP': status='BLOCKED'; reason='overlap'
    elif normalize_keyword(row.get('keyword')) in {normalize_keyword(x) for x in published_keywords}: status='BLOCKED'; reason='published'
    elif not str(row.get('suggested_url','')).startswith('/kor/') or row.get('suggested_url') in set(existing_urls): status='BLOCKED'; reason='duplicate_url'
    elif any(x in str(row.get('keyword','')).casefold() for x in ('세금','급여','대출','투자','보험','법률','의료','퇴직','수당','bmi')): status='BLOCKED'; reason='ymyl'
    elif not family: status='PAGE_REVIEW_READY'; reason='unsupported_family'
    else: status='SAFE_AUTO_ELIGIBLE'; reason='deterministic_family'
    return {'status':status,'family_id':family,'reason':reason,'keyword':row.get('keyword')}

def generate_page(candidate):
    keyword=str(candidate.get('keyword','계산기')); title=keyword.replace('계산기',' 계산기'); canonical=str(candidate.get('suggested_url','/kor/util/'))
    return ('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title>'
            '<link rel="canonical" href="'+canonical+'"><meta name="description" content="입력값을 안전하게 계산하는 무료 도구입니다."><script async src="https://www.googletagmanager.com/gtag/js?id=G-QP5Q67GE5B"></script><meta name="google-adsense-account" content="ca-pub-8830524482034754"><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication"}</script></head><body>'
            '<main><h1>'+title+'</h1><label>값 <input id="value" inputmode="decimal"></label>'
            '<button id="calculate" type="button">계산</button><output id="result"></output>'
            '<p>숫자를 입력하고 계산을 누르세요. 잘못된 입력은 오류로 안내합니다. 계산은 브라우저에서 처리됩니다.</p>'
            '<script>document.getElementById("calculate").onclick=function(){const v=Number(document.getElementById("value").value);document.getElementById("result").textContent=Number.isFinite(v)?v:"입력 오류"}</script>'
            '</main></body></html>')
