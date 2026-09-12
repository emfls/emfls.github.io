"""Official Naver APIs with bounded retries and reusable DataLab collection."""
import base64
import hashlib
import hmac
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, timedelta
from email.utils import parsedate_to_datetime
try:
    from scripts.keyword_hunter_core import volume
    from scripts.keyword_hunter_quota import QuotaExhausted
    from scripts.search_trend_signals import collect_naver_datalab
except ModuleNotFoundError:
    from keyword_hunter_core import volume
    from keyword_hunter_quota import QuotaExhausted
    from search_trend_signals import collect_naver_datalab

class ApiFailure(Exception):
    pass

def search_ads_hint(seed,max_length=20):
    words=re.findall(r'[가-힣A-Za-z0-9]+',str(seed))
    hint=''
    for word in words:
        if len(hint)+len(word)>max_length: break
        hint+=word
    return (hint or ''.join(words))[:max_length]

def trend_changes(points,end):
    values={}
    for p in points:
        try:
            d=date.fromisoformat(p['period']); v=float(p['ratio'])
            if 0<=v<=100: values[d]=v
        except (KeyError,TypeError,ValueError): continue
    def average(start,stop):
        days=[end-timedelta(days=i) for i in range(start,stop)]
        measured=[values[d] for d in days if d in values]
        # DataLab can omit no-signal dates. Require enough observations without
        # fabricating zeroes for omitted dates.
        if len(measured)<max(1,len(days)//2): return None
        return sum(measured)/len(measured)
    current=average(0,30); result={}
    for key,start in [('trend_1m',30),('trend_3m',90)]:
        previous=average(start,start+30)
        result[key]=round((current/previous-1)*100,2) if current is not None and previous not in (None,0) else None
    result['trend_momentum']=result['trend_1m']
    prior_year=average(365,395)
    result['seasonality']=round(current/prior_year,3) if current is not None and prior_year not in (None,0) else None
    return result

class Client:
    def __init__(self,config,env=None,transport=None,sleep=time.sleep,offline=False,usage_tracker=None):
        self.config=dict(config); self.env=os.environ if env is None else env
        self.transport=transport or self._transport; self.sleep=sleep; self.offline=offline
        self.calls=0; self.datalab_calls=0; self.datalab_keywords_submitted=0; self.datalab_keywords_validated=0
        self.web_result_calls=0
        self.rate_limits=0; self.errors=[]; self.usage_tracker=usage_tracker
        self.source=''; self.seed=''
        self.statuses={
            'NAVER_SEARCH_ADS':'NOT_CONFIGURED' if not all(self._search_ads_keys()) else 'API_ERROR',
            'NAVER_DATALAB':'NOT_CONFIGURED' if not all(self._datalab_keys()) else 'API_ERROR',
            'NAVER_WEB_SEARCH':'NOT_CONFIGURED' if not all(self._web_keys()) else 'API_ERROR',
            'NAVER_WEB_SEARCH_PERMISSION':'UNKNOWN',
            'EXTERNAL_RSS':'DEGRADED',
        }
    def _search_ads_keys(self):
        return [self.env.get(k) for k in ('NAVER_SEARCHAD_API_KEY','NAVER_SEARCHAD_SECRET_KEY','NAVER_SEARCHAD_CUSTOMER_ID')]
    def _datalab_keys(self):
        return [self.env.get('NAVER_API_HUB_CLIENT_ID') or self.env.get('NAVER_CLIENT_ID') or self.env.get('NAVER_DATALAB_CLIENT_ID'),
                self.env.get('NAVER_API_HUB_CLIENT_SECRET') or self.env.get('NAVER_CLIENT_SECRET') or self.env.get('NAVER_DATALAB_CLIENT_SECRET')]
    def _uses_datalab_api_hub(self):
        return bool(self.env.get('NAVER_API_HUB_CLIENT_ID') and self.env.get('NAVER_API_HUB_CLIENT_SECRET'))
    def _web_keys(self):
        return [self.env.get('NAVER_WEB_SEARCH_API_HUB_CLIENT_ID') or self.env.get('NAVER_API_HUB_CLIENT_ID') or self.env.get('NAVER_WEB_SEARCH_CLIENT_ID') or self.env.get('NAVER_CLIENT_ID'),
                self.env.get('NAVER_WEB_SEARCH_API_HUB_CLIENT_SECRET') or self.env.get('NAVER_API_HUB_CLIENT_SECRET') or self.env.get('NAVER_WEB_SEARCH_CLIENT_SECRET') or self.env.get('NAVER_CLIENT_SECRET')]
    def _uses_web_api_hub(self):
        return bool((self.env.get('NAVER_WEB_SEARCH_API_HUB_CLIENT_ID') and self.env.get('NAVER_WEB_SEARCH_API_HUB_CLIENT_SECRET')) or
                    (self.env.get('NAVER_API_HUB_CLIENT_ID') and self.env.get('NAVER_API_HUB_CLIENT_SECRET')))
    def health(self):
        return dict(self.statuses)
    def _set_failure_status(self,source,code):
        service={'NAVER_SEARCHAD':'NAVER_SEARCH_ADS','NAVER_DATALAB':'NAVER_DATALAB',
                 'NAVER_WEB_SEARCH':'NAVER_WEB_SEARCH','PUBLIC_RSS':'EXTERNAL_RSS'}.get(source)
        if not service: return
        if 'NOT_CONFIGURED' in code or code=='NOT_CONNECTED': status='NOT_CONFIGURED'
        elif code in {'HTTP_401','HTTP_403'}: status='AUTH_ERROR'
        elif code in {'HTTP_429','RETRY_AFTER_DEFERRED'}: status='RATE_LIMITED'
        elif code in {'NETWORK_ERROR'}: status='NETWORK_ERROR' if service!='EXTERNAL_RSS' else 'DEGRADED'
        else: status='API_ERROR' if service!='EXTERNAL_RSS' else 'DEGRADED'
        self.statuses[service]=status
    def _transport(self,request):
        with urllib.request.urlopen(request,timeout=self.config['timeout']) as response:
            raw=response.read(2_000_001)
            if len(raw)>2_000_000: raise ApiFailure('RESPONSE_TOO_LARGE')
            return raw
    def error(self,code):
        row={'source':self.source,'seed':self.seed,'code':str(code)}
        if row not in self.errors: self.errors.append(row)
        self._set_failure_status(self.source,str(code))
    def request(self,request):
        for attempt in range(self.config['retries']+1):
            if self.offline: raise ApiFailure('OFFLINE')
            if self.calls>=self.config['max_api_calls']: raise ApiFailure('CALL_BUDGET')
            if self.source=='NAVER_DATALAB' and self.usage_tracker and not self.usage_tracker.can_call(): raise ApiFailure('DATALAB_BUDGET')
            if self.config['request_interval']: self.sleep(self.config['request_interval'])
            try:
                if self.source=='NAVER_DATALAB' and self.usage_tracker:
                    try: self.usage_tracker.record_attempt()
                    except QuotaExhausted: raise ApiFailure('DATALAB_BUDGET') from None
                self.calls+=1
                if self.source=='NAVER_DATALAB': self.datalab_calls+=1
                return self.transport(request)
            except urllib.error.HTTPError as e:
                retry=e.code==429 or 500<=e.code<=599
                if e.code==429: self.rate_limits+=1
                if not retry or attempt==self.config['retries']: raise ApiFailure('HTTP_{}'.format(e.code)) from None
                delay=max(30,self.config['backoff']*2**attempt) if e.code==429 else self.config['backoff']*2**attempt
                retry_after=e.headers.get('Retry-After') if e.headers else None
                if retry_after:
                    try: delay=max(delay,float(retry_after))
                    except ValueError:
                        try: delay=max(delay,parsedate_to_datetime(retry_after).timestamp()-time.time())
                        except (ValueError,TypeError): pass
                if delay>300: raise ApiFailure('RETRY_AFTER_DEFERRED') from None
                self.sleep(delay)
            except (urllib.error.URLError,TimeoutError,OSError):
                if attempt==self.config['retries']: raise ApiFailure('NETWORK_ERROR') from None
                self.sleep(min(60,self.config['backoff']*2**attempt))
        raise ApiFailure('RETRY_EXHAUSTED')
    def related(self,seed):
        self.source='NAVER_SEARCHAD'; self.seed=seed
        if self.offline: return []
        keys=self._search_ads_keys()
        if not all(keys): self.error('NAVER_SEARCH_ADS_NOT_CONFIGURED'); return []
        timestamp=str(int(time.time()*1000)); uri='/keywordstool'
        signature=base64.b64encode(hmac.new(keys[1].encode(),(timestamp+'.GET.'+uri).encode(),hashlib.sha256).digest()).decode()
        url='https://api.searchad.naver.com'+uri+'?'+urllib.parse.urlencode({'hintKeywords':search_ads_hint(seed),'showDetail':'1'})
        req=urllib.request.Request(url,headers={'X-Timestamp':timestamp,'X-API-KEY':keys[0],'X-Customer':keys[2],'X-Signature':signature})
        try:
            payload=json.loads(self.request(req)); rows=[]
            for item in payload['keywordList']:
                keyword=item.get('relKeyword')
                if not isinstance(keyword,str) or not keyword.strip(): continue
                raw_pc=item.get('monthlyPcQcCnt'); raw_mobile=item.get('monthlyMobileQcCnt')
                pc=volume(raw_pc); mobile=volume(raw_mobile)
                pc_known=pc is not None or str(raw_pc or '').strip().startswith('<')
                mobile_known=mobile is not None or str(raw_mobile or '').strip().startswith('<')
                total=(pc or 0)+(mobile or 0) if pc_known and mobile_known else None
                rows.append({'keyword':keyword,'monthly_pc':pc,'monthly_mobile':mobile,
                             'monthly_total':total,
                             'competition':item.get('compIdx'),'source':self.source,
                             'source_seed':seed,
                             'volume_note':'LOWER_BOUND_CENSORED' if (pc is None and pc_known) or (mobile is None and mobile_known) else ('MISSING' if not pc_known or not mobile_known else '')})
            self.statuses['NAVER_SEARCH_ADS']='OK'
            return rows
        except ApiFailure as e: self.error(str(e))
        except (ValueError,KeyError,TypeError,AttributeError): self.error('INVALID_RESPONSE')
        return []
    def trends(self,keywords,as_of):
        if self.offline: return {}
        result={}; end=as_of-timedelta(days=1); start=end-timedelta(days=399)
        datalab_keys=self._datalab_keys()
        if not all(datalab_keys):
            self.source='NAVER_DATALAB'; self.seed=' / '.join(keywords[:5])
            self.error('NAVER_DATALAB_NOT_CONFIGURED'); return {}
        for i in range(0,len(keywords),5):
            batch=keywords[i:i+5]; self.source='NAVER_DATALAB'; self.seed=' / '.join(batch)
            self.datalab_keywords_submitted+=len(batch)
            calls_before=self.datalab_calls
            try:
                payload=collect_naver_datalab([{'groupName':k,'keywords':[k]} for k in batch],start.isoformat(),end.isoformat(),client_id=datalab_keys[0],client_secret=datalab_keys[1],transport=self.request,api_hub=self._uses_datalab_api_hub())
                if payload['status']!='VERIFIED_SEARCH_DATA':
                    # Existing adapter returns error text; only retain our safe codes.
                    warning=payload.get('warning','')
                    code=next((c for c in ['HTTP_401','HTTP_403','HTTP_429','CALL_BUDGET','DATALAB_BUDGET','NETWORK_ERROR','RETRY_AFTER_DEFERRED'] if c in warning),payload['status'])
                    self.error(code)
                for signal in payload['signals']:
                    if signal['topic'] in batch:
                        changes=trend_changes(signal['points'],end); result[signal['topic']]=changes
                        if any(changes.get(k) is not None for k in ('trend_1m','trend_3m')):
                            self.datalab_keywords_validated+=1
                if payload['status']=='VERIFIED_SEARCH_DATA': self.statuses['NAVER_DATALAB']='OK'
            except (ValueError,TypeError,KeyError,AttributeError): self.error('INVALID_RESPONSE')
            if self.statuses['NAVER_DATALAB'] in {'AUTH_ERROR','RATE_LIMITED','NETWORK_ERROR'}: break
            if self.calls>=self.config['max_api_calls'] or (self.usage_tracker and not self.usage_tracker.can_call()): break
        return result
    def web_result_count(self,keyword):
        self.source='NAVER_WEB_SEARCH'; self.seed=keyword
        if self.offline: return None
        keys=self._web_keys()
        if not all(keys): self.error('NAVER_WEB_SEARCH_NOT_CONFIGURED'); return None
        if self.statuses['NAVER_WEB_SEARCH'] in {'AUTH_ERROR','RATE_LIMITED','NETWORK_ERROR'}: return None
        params={'query':keyword,'display':1,'start':1}
        if self._uses_web_api_hub():
            url='https://naverapihub.apigw.ntruss.com/search/v1/webkr?'+urllib.parse.urlencode({**params,'format':'json'})
            headers={'X-NCP-APIGW-API-KEY-ID':keys[0],'X-NCP-APIGW-API-KEY':keys[1]}
        else:
            url='https://openapi.naver.com/v1/search/webkr.json?'+urllib.parse.urlencode(params)
            headers={'X-Naver-Client-Id':keys[0],'X-Naver-Client-Secret':keys[1]}
        calls_before=self.calls
        try:
            payload=json.loads(self.request(urllib.request.Request(url,headers=headers)))
            total=volume(payload.get('total'))
            if total is None: raise ApiFailure('INVALID_RESPONSE')
            self.statuses['NAVER_WEB_SEARCH']='OK'
            self.statuses['NAVER_WEB_SEARCH_PERMISSION']='GRANTED'
            return total
        except ApiFailure as e:
            self.error(str(e))
            if str(e) in {'HTTP_401','HTTP_403'}:
                self.statuses['NAVER_WEB_SEARCH_PERMISSION']='REQUIRED'
        except (ValueError,TypeError,AttributeError): self.error('INVALID_RESPONSE')
        finally: self.web_result_calls+=self.calls-calls_before
        return None
    @property
    def datalab_average_keywords_per_call(self):
        return round(self.datalab_keywords_submitted/self.datalab_calls,2) if self.datalab_calls else 0.0
    def feed(self,url):
        self.source='PUBLIC_RSS'; self.seed=url
        if self.offline: return []
        if urllib.parse.urlparse(url).scheme!='https': self.error('HTTPS_REQUIRED'); return []
        try:
            root=ET.fromstring(self.request(urllib.request.Request(url,headers={'User-Agent':'emfls-keyword-hunter/1.0'})))
            result=[]
            for item in root.findall('.//item')+root.findall('.//{http://www.w3.org/2005/Atom}entry'):
                title=item.findtext('title') or item.findtext('{http://www.w3.org/2005/Atom}title')
                if title: result.append({'keyword':title,'source':'PUBLIC_RSS','evidence_url':item.findtext('link') or url})
            self.statuses['EXTERNAL_RSS']='OK'
            return result[:100]
        except ApiFailure as e: self.error(str(e))
        except (ET.ParseError,ValueError): self.error('INVALID_FEED')
        return []
