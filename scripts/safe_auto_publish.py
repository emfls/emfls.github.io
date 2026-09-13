"""Fail-closed SAFE_AUTO foundation; disabled production writes."""
import html,json
from pathlib import Path
from .content_launch_policy import normalize_keyword
CONFIG_PATH=Path(__file__).parents[1]/'data/safe-auto-page-families.json'
DEFAULT={'percentage_calculator':{'enabled':True,'patterns':('퍼센트계산기','비율계산기','percentage calculator','ratio calculator'),'blocked':('세금','급여','대출','투자','보험','의료','bmi','퇴직','수당','추천')},'unit_converter':{'enabled':False,'patterns':('단위계산기','단위변환'),'blocked':()},'text_counter':{'enabled':False,'patterns':('글자수계산기','문자수계산기'),'blocked':()},'date_arithmetic':{'enabled':False,'patterns':('날짜계산기','날짜계산'),'blocked':()}}
def _families():
 try:
  d=json.loads(CONFIG_PATH.read_text()); return {k:{**DEFAULT[k],**v} for k,v in d.get('families',{}).items()}
 except (OSError,ValueError,TypeError): return DEFAULT
def resolve_family(keyword):
 t=str(keyword or '').casefold()
 for k,s in _families().items():
  if any(p.casefold() in t for p in s['patterns']) and not any(b.casefold() in t for b in s['blocked']): return k
 return None
def percentage_of(base,rate):
 v=round(float(base)*float(rate)/100,10); return v if v==v and abs(v)!=float('inf') else None
def percentage_ratio(part,whole):
 if float(whole)==0:return None
 return round(float(part)/float(whole)*100,10)
def percentage_change(base,rate,direction='increase'):
 v=round(float(base)*(1+(1 if direction=='increase' else -1)*float(rate)/100),10); return v if v==v and abs(v)!=float('inf') else None
def eligibility(candidate,existing_urls,published_keywords,launched_count,daily_limit,config_enabled=False):
 r=dict(candidate); f=resolve_family(r.get('keyword')); reason=''
 if not config_enabled: status,reason='BLOCKED','safe_auto_disabled'
 elif int(launched_count)>=int(daily_limit): status,reason='BLOCKED','daily_limit'
 elif str(r.get('score_valid')).casefold() not in {'true','1','yes'}: status,reason='BLOCKED','invalid_score'
 elif r.get('review_status')!='PAGE_REVIEW_READY': status,reason='BLOCKED','review_required'
 elif r.get('status') in {'PUBLISHED','REJECTED','COOLDOWN','EXPIRED'}: status,reason='BLOCKED','ineligible'
 elif r.get('action','NEW_PAGE')!='NEW_PAGE' or r.get('overlap','NO_OVERLAP')!='NO_OVERLAP': status,reason='BLOCKED','policy'
 elif normalize_keyword(r.get('keyword')) in {normalize_keyword(x) for x in published_keywords}: status,reason='BLOCKED','published'
 elif not str(r.get('suggested_url','')).startswith('/kor/util/') or r.get('suggested_url') in set(existing_urls): status,reason='BLOCKED','duplicate_url'
 elif any(x in str(r.get('keyword','')).casefold() for x in ('세금','급여','대출','투자','보험','법률','의료','퇴직','수당','bmi')): status,reason='BLOCKED','ymyl'
 elif not f: status,reason='PAGE_REVIEW_READY','unsupported_family'
 elif not _families().get(f,{}).get('enabled'): status,reason='PAGE_REVIEW_READY','family_disabled'
 else: status,reason='SAFE_AUTO_ELIGIBLE','deterministic_family'
 return {'status':status,'family_id':f,'reason':reason,'keyword':r.get('keyword')}
def generate_page(candidate):
 k=html.escape(str(candidate.get('keyword','계산기'))); u=html.escape(str(candidate.get('suggested_url','/kor/util/')),quote=True); t=k.replace('계산기',' 계산기')
 return f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{t}</title><meta name="description" content="퍼센트와 비율을 계산하는 무료 도구입니다."><meta name="robots" content="index,follow"><link rel="canonical" href="https://emfls.github.io{u}"><meta property="og:type" content="website"><meta property="og:title" content="{t}"><meta property="og:description" content="퍼센트와 비율을 계산하는 무료 도구입니다."><meta property="og:url" content="https://emfls.github.io{u}"><script async src="https://www.googletagmanager.com/gtag/js?id=G-QP5Q67GE5B"></script><meta name="google-adsense-account" content="ca-pub-8830524482034754"><script type="application/ld+json">{{"@context":"https://schema.org","@type":"WebApplication"}}</script></head><body><main><h1>{t}</h1><section><h2>계산 모드</h2><p>① X의 Y% ② A는 B의 몇 % ③ 증가·감소 후 값</p><input id="base"><input id="rate"><button id="calculate">계산</button><output id="result"></output></section><section><h2>사용법과 공식</h2><p>200의 15%는 30입니다. 기준값×퍼센트÷100으로 계산합니다. 30은 200의 15%이며 100에서 10% 증가하면 110, 감소하면 90입니다.</p></section><section><h2>자주 헷갈리는 경우</h2><p>분모가 0이거나 숫자가 아니면 입력 오류입니다.</p></section><script>document.getElementById('calculate').onclick=function(){{const b=Number(base.value),r=Number(rate.value);result.textContent=Number.isFinite(b)&&Number.isFinite(r)?b*r/100:'입력 오류'}}</script></main></body></html>'''
def validate_generated_page(source): return source.count('<h1>')==1 and source.count('<h2>')>=3 and 'G-QP5Q67GE5B' in source and 'ca-pub-8830524482034754' in source and 'TODO' not in source
