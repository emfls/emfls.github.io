"""Explainable Keyword Hunter rules. No network or filesystem side effects."""
import math
import re
import unicodedata
from collections import Counter

DEFAULT_CONFIG = {
    'target': 200, 'max_depth': 4, 'category_share': .20, 'max_seeds': 40,
    'exploration': {'longtail': 60, 'discovery': 25, 'trend': 15},
    'weights': {'demand':25,'trend':15,'longtail':15,'competition':20,'commercial':10,'fit':10,'freshness':5},
    'max_api_calls': 100, 'datalab_monthly_limit': 50000, 'datalab_reserve_ratio': .10,
    'scheduled_runs_per_day': 12, 'retries': 3,
    'timeout': 15, 'backoff': 1, 'request_interval': 1,
    'search_ads_cache_ttl_hours': 168, 'refresh_hours': 24,
    'datalab_cache_ttl_hours': 24,
    'web_result_cache_ttl_hours': 168, 'web_result_validation_limit': 50,
    'fast_filter_min_monthly_total': 10,
    'max_unverified_candidates': 20, 'min_score': 35, 'min_data_coverage': 100,
    'fit_categories': ['camp','palworld','tools','travel','visa','window','gov','finance','animal','game'],
    'rss_feeds': ['https://www.moel.go.kr/rss/policy.do'],
    'synonyms': {'팔월드':'팰월드','palworld':'팰월드','에러':'오류','해결방법':'해결','해결법':'해결','신청방법':'신청','신청법':'신청'},
}
FIELDS = 'keyword parent_keyword cluster category monthly_pc monthly_mobile monthly_total competition source_seed trend_1m trend_3m trend_momentum seasonality web_result_count demand_supply_ratio competition_ratio result_count_checked_at commercial_intent freshness longtail_score content_fit opportunity_score score_valid score_invalid_reasons data_coverage novelty_score theme_state seed_source exploration_bucket status discovered_at last_checked source depth confidence content_types intent action closest_url overlap reason strategy volume_note search_ads_checked_at datalab_checked_at'.split()
TRANSITIONS = {'NEW':{'REVIEWED','REJECTED'},'REVIEWED':{'QUEUED','REJECTED'},'QUEUED':{'PUBLISHED','REVIEWED','REJECTED'},'PUBLISHED':set(),'REJECTED':{'REVIEWED'}}

def normalize(text, synonyms=None):
    text = unicodedata.normalize('NFKC',str(text or '')).casefold()
    for old,new in sorted((synonyms or DEFAULT_CONFIG['synonyms']).items(),key=lambda p:-len(p[0])):
        text=text.replace(old,new)
    return ''.join(ch for ch in text if ch.isalnum())

def grams(text):
    text=normalize(text)
    return {text[i:i+2] for i in range(len(text)-1)} or {text}

def similarity(a,b):
    a,b=grams(a),grams(b)
    return len(a&b)/max(1,len(a|b))

def same_intent(a,b):
    if re.findall(r'\d+',a)!=re.findall(r'\d+',b): return False
    return normalize(a)==normalize(b) or (similarity(a,b)>=.86 and tags(a)==tags(b))

def tags(keyword, trend=None):
    rules={'calculator/tool':['계산','변환','도구'],'comparison':['비교','차이',' vs '],
           'how-to':['방법','신청','설정','사용법','하는법'],'troubleshooting':['오류','에러','안됨','안 될','해결','실패'],
           'checklist':['체크리스트','준비물','서류'],'commercial':['가격','비용','추천','구매','요금'],
           'current-information':['2026','최신','변경','기간','일정','조건']}
    found=[tag for tag,words in rules.items() if any(word in keyword for word in words)]
    if trend is not None and float(trend)>20: found.append('trending')
    found.append('informational')
    if 'trending' not in found and 'current-information' not in found: found.append('evergreen')
    return sorted(found)

def volume(value):
    try:
        number=float(value)
        return int(number) if math.isfinite(number) and number>=0 else None
    except (ValueError,TypeError): return None

def number(value):
    try:
        v=float(value)
        return v if math.isfinite(v) else None
    except (ValueError,TypeError): return None

def score(row, config):
    ts=tags(row['keyword'],number(row.get('trend_1m')))
    total=number(row.get('monthly_total'))
    trends=[number(row.get(k)) for k in ('trend_1m','trend_3m')]
    measured=[x for x in trends if x is not None]
    competition={'낮음':1,'중간':.5,'높음':0,'LOW':1,'MEDIUM':.5,'HIGH':0}.get(row.get('competition'))
    web_total=number(row.get('web_result_count'))
    specific=min(1,len(normalize(row['keyword']))/20)*(.9 if len(ts)>2 else .4)
    components={'demand':min(1,math.log1p(max(0,total))/math.log1p(10000)) if total is not None else None,
                'trend':max(0,min(1,.5+sum(measured)/len(measured)/200)) if measured else None,
                'longtail':specific,'competition':competition,'commercial':.9 if 'commercial' in ts else .3,
                'fit':.9 if row.get('category') in config['fit_categories'] else .4,
                'freshness':1 if 'current-information' in ts or 'trending' in ts else .2}
    weights=config['weights']; denominator=sum(weights.values())
    if denominator<=0 or any(v<0 for v in weights.values()): raise ValueError('Invalid score weights')
    value=sum((components[k] or 0)*w for k,w in weights.items())/denominator*100
    volume_ok=total is not None and total>0
    trend_ok=bool(measured)
    web_ok=web_total is not None
    coverage=(30*int(volume_ok)+20*int(competition is not None)+
              15*int(trends[0] is not None)+15*int(trends[1] is not None)+20*int(web_ok))
    confidence='HIGH' if volume_ok and trend_ok and web_ok else 'MEDIUM' if volume_ok and trend_ok else 'LOW' if volume_ok else 'UNVERIFIED'
    valid=volume_ok and trend_ok
    missing=[]
    if not volume_ok: missing.append('monthly_volume_missing')
    if competition is None: missing.append('competition_missing')
    if not trend_ok: missing.append('trend_missing')
    if not web_ok: missing.append('web_result_missing')
    invalid_reasons='|'.join(missing) if not valid else ''
    return {'opportunity_score':round(value,2) if valid else None,'score_valid':valid,
            'score_invalid_reasons':invalid_reasons,'data_coverage':coverage,'confidence':confidence,
            'commercial_intent':components['commercial'],'freshness':components['freshness'],
            'longtail_score':specific,'content_fit':components['fit'],'content_types':'|'.join(ts),
            'intent':next((t for t in ts if t not in {'commercial','evergreen','informational','current-information','trending'}),'informational')}

def transition(row,status):
    old=row.get('status','NEW')
    if status=='QUEUED' and (row.get('confidence')=='UNVERIFIED' or row.get('score_valid') in {False,'False','false','0',''}):
        raise ValueError('UNVERIFIED keyword cannot enter content queue')
    if status!=old and status not in TRANSITIONS.get(old,set()): raise ValueError('Invalid status transition: {} -> {}'.format(old,status))
    row['status']=status
    return row

def allocate(total,ratios):
    s=sum(ratios.values())
    if s<=0 or any(x<0 for x in ratios.values()): raise ValueError('Invalid exploration ratios')
    out={k:int(total*v/s) for k,v in ratios.items()}
    for k in sorted(ratios,key=lambda k:-(total*ratios[k]/s-out[k]))[:total-sum(out.values())]: out[k]+=1
    return out

def diverse(rows,limit,share):
    if limit<=0: return []
    counts=Counter(); result=[]; cap=max(1,math.ceil(limit*share))
    for row in rows:
        category=row.get('category','other')
        if counts[category]<cap:
            result.append(row); counts[category]+=1
            if len(result)>=limit: break
    return result
