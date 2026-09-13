"""Config-driven, fail-closed SAFE_AUTO foundation (production disabled)."""
import html, json, re
from pathlib import Path
from .content_launch_policy import normalize_keyword

CONFIG_PATH=Path(__file__).parents[1]/'data/safe-auto-page-families.json'
GENERATORS={'percentage_calculator': True}
VALIDATORS={'percentage_calculator_v1': True}

def validate_config(config):
    if not isinstance(config,dict) or config.get('schemaVersion')!=2 or not isinstance(config.get('enabled'),bool): return False
    if int(config.get('dailyLimit',-1))<0 or config.get('maxPagesPerRun')!=1 or not isinstance(config.get('families'),dict): return False
    for spec in config['families'].values():
        if not isinstance(spec,dict) or not isinstance(spec.get('enabled'),bool) or not isinstance(spec.get('allowedPatterns'),list) or not spec['allowedPatterns'] or not isinstance(spec.get('blockedTerms'),list): return False
        if spec.get('enabled') and (spec.get('generator') not in GENERATORS or spec.get('validationContract') not in VALIDATORS): return False
    return True
def load_config(path=CONFIG_PATH):
    try:
        c=json.loads(Path(path).read_text(encoding='utf-8')); return c if validate_config(c) else None
    except (OSError,ValueError,TypeError): return None
def resolve_family(keyword, config=None):
    c=config if config is not None else load_config()
    if not c or not validate_config(c): return None
    text=str(keyword or '').casefold()
    for family,s in c['families'].items():
        if any(str(p).casefold() == text.replace(' ','') for p in s['allowedPatterns']) and not any(str(b).casefold() in text for b in s['blockedTerms']): return family
    return None
def percentage_of(base,rate):
    try: v=round(float(base)*float(rate)/100,10); return v if v==v and abs(v)!=float('inf') else None
    except (TypeError,ValueError): return None
def percentage_ratio(part,whole):
    try:
        if float(whole)==0:return None
        return round(float(part)/float(whole)*100,10)
    except (TypeError,ValueError): return None
def percentage_change(base,rate,direction='increase'):
    try:
        v=round(float(base)*(1+(1 if direction=='increase' else -1)*float(rate)/100),10); return v if v==v and abs(v)!=float('inf') else None
    except (TypeError,ValueError): return None
def eligibility(candidate,existing_urls,published_keywords,launched_count,daily_limit,config=None):
    r=dict(candidate); c=config if config is not None else load_config(); f=resolve_family(r.get('keyword'),c); reason=''
    if not c: status,reason='BLOCKED','invalid_registry'
    elif not c.get('enabled'): status,reason='BLOCKED','safe_auto_disabled'
    elif int(launched_count)>=int(daily_limit): status,reason='BLOCKED','daily_limit'
    elif str(r.get('score_valid')).casefold() not in {'true','1','yes'}: status,reason='BLOCKED','invalid_score'
    elif r.get('review_status')!='PAGE_REVIEW_READY': status,reason='BLOCKED','review_required'
    elif r.get('status') in {'PUBLISHED','REJECTED','COOLDOWN','EXPIRED'}: status,reason='BLOCKED','ineligible'
    elif r.get('action','NEW_PAGE')!='NEW_PAGE' or r.get('overlap','NO_OVERLAP')!='NO_OVERLAP': status,reason='BLOCKED','policy'
    elif normalize_keyword(r.get('keyword')) in {normalize_keyword(x) for x in published_keywords}: status,reason='BLOCKED','published'
    elif not str(r.get('suggested_url','')).startswith('/kor/util/') or r.get('suggested_url') in set(existing_urls): status,reason='BLOCKED','duplicate_url'
    elif any(x in str(r.get('keyword','')).casefold() for x in ('세금','급여','대출','투자','보험','법률','의료','퇴직','수당','bmi')): status,reason='BLOCKED','ymyl'
    elif not f: status,reason='PAGE_REVIEW_READY','unsupported_family'
    elif not c['families'][f].get('enabled'): status,reason='PAGE_REVIEW_READY','family_disabled'
    else: status,reason='SAFE_AUTO_ELIGIBLE','deterministic_family'
    return {'status':status,'family_id':f,'reason':reason,'keyword':r.get('keyword')}
def generate_page(candidate,config=None):
    if not (config or load_config()) or resolve_family(candidate.get('keyword'),config or load_config())!='percentage_calculator': raise ValueError('unsupported generator')
    k=html.escape(str(candidate.get('keyword','계산기'))); u=html.escape(str(candidate.get('suggested_url','/kor/util/')),quote=True); t=k.replace('계산기',' 계산기')
    return f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{t}</title><meta name="description" content="퍼센트와 비율을 계산하는 무료 도구입니다."><meta name="robots" content="index,follow"><link rel="canonical" href="https://emfls.github.io{u}"><meta property="og:type" content="website"><meta property="og:title" content="{t}"><meta property="og:description" content="퍼센트와 비율을 계산하는 무료 도구입니다."><meta property="og:url" content="https://emfls.github.io{u}"><script async src="https://www.googletagmanager.com/gtag/js?id=G-QP5Q67GE5B"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments)}}gtag("js",new Date());gtag("config","G-QP5Q67GE5B");</script><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8830524482034754" crossorigin="anonymous"></script><script type="application/ld+json">{{"@context":"https://schema.org","@type":"WebApplication"}}</script></head><body><main><h1>{t}</h1><section><h2>계산 모드</h2><select id="mode"><option value="of">X의 Y%</option><option value="ratio">A는 B의 몇 %</option><option value="change">증가·감소</option></select><input id="base"><input id="rate"><select id="direction"><option value="increase">증가</option><option value="decrease">감소</option></select><button id="calculate">계산</button><output id="result"></output></section><section><h2>사용법과 공식</h2><p>200의 15%는 30입니다. 기준값×퍼센트÷100입니다. 30은 200의 15%이며 100에서 10% 증가하면 110, 감소하면 90입니다.</p></section><section><h2>자주 헷갈리는 경우</h2><p>분모가 0이거나 숫자가 아니면 입력 오류입니다.</p></section><script>calculate.onclick=function(){{const b=Number(base.value),r=Number(rate.value),m=mode.value;let v=m==='of'?b*r/100:m==='ratio'?(r===0?NaN:b/r*100):b*(1+(direction.value==='increase'?1:-1)*r/100);result.textContent=Number.isFinite(v)?v:'입력 오류'}}</script></main></body></html>'''
def validate_generated_page(source, suggested_url=None):
    try: json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>',source).group(1))
    except Exception:return False
    if suggested_url and ('https://emfls.github.io'+suggested_url) not in source: return False
    return source.count('<html lang="ko">')==1 and source.count('<title>')==1 and 'name="description"' in source and 'name="robots"' in source and source.count('<h1>')==1 and source.count('<h2>')>=3 and 'WebApplication' in source and 'G-QP5Q67GE5B' in source and 'adsbygoogle.js?client=ca-pub-8830524482034754' in source and 'gtag("config","G-QP5Q67GE5B")' in source and 'TODO' not in source and '입력 오류' in source
