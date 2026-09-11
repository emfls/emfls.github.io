#!/usr/bin/env python3
"""Persistent Naver-first keyword discovery. Run from any working directory."""
import argparse
import json
import math
import os
import re
import sys
from collections import Counter
from contextlib import nullcontext
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path

if __package__ in (None,''):
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from scripts.keyword_hunter_core import DEFAULT_CONFIG, allocate, diverse, normalize, same_intent, score, transition, number
from scripts.keyword_hunter_api import Client
from scripts.keyword_hunter_quota import DataLabUsage
from scripts.keyword_hunter_site import inventory, SiteIndex
from scripts.keyword_hunter_state import read_json, read_master, csv_text, json_text, commit, locked
from scripts.search_trend_signals import load_trendradar_sqlite
from scripts.keyword_hunter_exploration import ANCHORED_SOURCES, cooldown_clusters, enforce_candidate_shares, recovery_active, recovery_seed_fragments, select_exploration_seeds, update_history
from scripts.keyword_hunter_improvements import select_improvement_candidates

KST=timezone(timedelta(hours=9))

def load_env_file(root,environ=None):
    """Load local secrets for CLI runs without replacing exported variables."""
    import os
    environ=os.environ if environ is None else environ
    path=Path(root).resolve()/'.env'
    if not path.exists(): return
    for raw in path.read_text(encoding='utf-8').splitlines():
        line=raw.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        name,value=line.split('=',1); name=name.strip(); value=value.strip()
        if value[:1] in {'"',"'"} and value[-1:]==value[:1]: value=value[1:-1]
        if name and name not in environ: environ[name]=value

def category(keyword):
    for cat,terms in {'palworld':['팰월드','팔월드'],'camp':['캠핑','차박','텐트'],'tools':['계산','변환','qr'],
                      'visa':['비자'],'travel':['여행','항공','예약'],'window':['윈도우','windows'],
                      'gov':['지원','휴직','신청','정책'],'finance':['요금','세금','연금'],'animal':['고양이','강아지']}.items():
        if any(t in keyword.casefold() for t in terms): return cat
    # Unknown external subjects receive distinct topic buckets, not a universal "other" bucket.
    words=re.findall(r'[가-힣A-Za-z]{2,}',keyword)
    return 'topic:'+normalize(words[0]) if words else 'other'

def choose_seeds(seeds,master,config):
    pool={normalize(s['keyword']):dict(s) for s in seeds}
    for row in sorted(master,key=lambda r:-(number(r.get('opportunity_score')) or 0)):
        if row.get('status')=='REJECTED' or row.get('action') in {'REJECT','IMPROVE_EXISTING','WAIT_FOR_DATA'}: continue
        if int(row.get('depth') or 0)>=config['max_depth']: continue
        key=normalize(row['keyword'])
        if key not in pool:
            pool[key]={'keyword':row['keyword'],'depth':int(row.get('depth') or 0),'category':row['category'],
                       'strategy':'longtail','score':number(row.get('opportunity_score')) or 0,'source':row['source']}
    rejected_keys={normalize(r['keyword']) for r in master if r.get('status')=='REJECTED'}
    eligible=[s for s in pool.values() if normalize(s['keyword']) not in rejected_keys if int(s.get('depth') or 0)<config['max_depth'] and s.get('status')!='REJECTED']
    eligible.sort(key=lambda s:(s.get('last_expanded',''),-(number(s.get('score')) or 0),s['keyword']))
    quotas=allocate(config['max_seeds'],config['exploration']); selected=[]
    for strategy,quota in quotas.items():
        selected.extend(diverse([s for s in eligible if s.get('strategy','longtail')==strategy],quota,config['category_share']))
    return selected

def seed_is_cached(seed,now,ttl_hours):
    last=seed.get('last_expanded')
    if not last or seed.get('search_ads_status')!='OK': return False
    return (now-datetime.fromisoformat(last)).total_seconds()<ttl_hours*3600

def prioritize_trend_rows(rows,fresh):
    fresh_keys={normalize(r.get('keyword','')) for r in fresh}
    def priority(row):
        fresh_rank=normalize(row.get('keyword','')) not in fresh_keys
        bucket={'new_theme':0,'promising':1,'winner':2,'backlog':3}.get(row.get('exploration_bucket'),4)
        return (fresh_rank,bucket,
                -(number(row.get('monthly_total')) or 0),
                -(number(row.get('opportunity_score')) or 0),row.get('keyword',''))
    return sorted(rows,key=priority)

def fast_filter_rows(rows,fresh,now,config,recovery=False):
    """Cheap Search Ads coverage gate before spending DataLab quota."""
    ordered=prioritize_trend_rows(rows,fresh); passed=[]
    fresh_keys={normalize(r.get('keyword','')) for r in fresh}
    ttl=config.get('datalab_cache_ttl_hours',24)*3600
    minimum=max(1,config.get('fast_filter_min_monthly_total',10)//2) if recovery else config.get('fast_filter_min_monthly_total',10)
    for row in ordered:
        if number(row.get('monthly_total')) is None or number(row.get('monthly_total'))<minimum or not row.get('competition'): continue
        checked=row.get('datalab_checked_at')
        has_trend=number(row.get('trend_1m')) is not None and number(row.get('trend_3m')) is not None
        if checked and has_trend and normalize(row.get('keyword','')) not in fresh_keys:
            try:
                if (now-datetime.fromisoformat(checked)).total_seconds()<ttl: continue
            except ValueError: pass
        passed.append(row)
    return ordered,passed

def datalab_usage(root,config,now=None):
    limit=int(os.environ.get('DATALAB_MONTHLY_LIMIT',config.get('datalab_monthly_limit',50000)))
    reserve=float(os.environ.get('DATALAB_RESERVE_RATIO',config.get('datalab_reserve_ratio',.10)))
    return DataLabUsage(root,limit,reserve,config.get('scheduled_runs_per_day',12),now=(lambda:now) if now else None)

def excluded_lineage_keys(master,roots):
    excluded=set(roots); changed=True
    while changed:
        changed=False
        for row in master:
            key=normalize(row.get('keyword',''))
            ancestry={normalize(row.get('parent_keyword') or ''),normalize(row.get('cluster') or '')}
            if key and key not in excluded and ancestry & excluded:
                excluded.add(key); changed=True
    return excluded

def external_seeds(root,client,config,now):
    result=[]
    for name in ['external-content-opportunities.json','external-discovery-input.json']:
        payload=read_json(root/'data'/name,{})
        for row in payload.get('candidates',[]):
            if row.get('status') in {'REJECTED','SAME_INTENT','FAILED_PATTERN'}: continue
            keyword=(row.get('discovery') or {}).get('observedTopic') or row.get('idea')
            if keyword: result.append({'keyword':keyword,'source':'EXISTING_EXTERNAL','strategy':'discovery'})
    import os
    db=os.environ.get('TREND_RADAR_DB')
    if db:
        for row in load_trendradar_sqlite(db,limit=100).get('signals',[]):
            # Only recent observations belong in trend exploration.
            if str(row.get('lastSeen',''))[:10] >= (now.date()-timedelta(days=7)).isoformat():
                result.append({'keyword':row['title'],'source':'TREND_RADAR','strategy':'trend'})
    for url in config['rss_feeds']:
        for i,row in enumerate(client.feed(url)):
            result.append({**row,'strategy':'discovery' if i%2==0 else 'trend'})
    for row in result:
        row.update(category=category(row['keyword']),depth=0,discovered_at=now.isoformat())
    return result

def safe(text): return str(text if text not in (None,'') else '미확인').replace('|','/').replace('\n',' ')

def merge_validation_data(row,updates):
    """Merge measured values without erasing earlier data with empty responses."""
    for key,value in updates.items():
        if value not in (None,''):
            row[key]=value
    return row

def report(result,now):
    lines=['# Keyword Hunter', '', '- 실행: '+now.isoformat()]
    for key in ['target','seeds_checked','new_keywords','duplicates','rejected','db_total','api_calls','rate_limits','api_health','strategy_counts','new_categories','shortfall','missing_data','site_pages','existing_page_improvement_candidates']:
        lines.append('- {}: {}'.format(key,safe(result[key])))
    lines+=['','## 자율 탐색 지표','']
    for key in ['exploration_candidates','new_seed_count','repeated_seed_count','recent_seed_overlap','new_category_count','new_cluster_count','novelty_ratio','category_shares','source_shares','winner_count','new_theme_winners','cooldown_clusters','next_exploration_directions','random_seed']:
        lines.append('- {}: {}'.format(key,safe(result[key])))
    lines+=['','## DISCOVERY FUNNEL','']
    funnel=result['discovery_funnel']; previous=None
    for key in ['seeds_considered','cooldown_excluded','seeds_queried','raw_keywords','normalized_keywords','db_duplicates_removed','category_saturation_excluded','novelty_excluded','novelty_passed','fast_filter_entered','fast_filter_passed','naver_web_result_count_calls','datalab_verified','score_valid_count','winner_threshold_excluded','candidate_count','winner_count']:
        value=funnel[key]
        rate=round(100*value/previous,2) if previous not in (None,0) and key not in {'cooldown_excluded','db_duplicates_removed','category_saturation_excluded','novelty_excluded','winner_threshold_excluded'} else None
        lines.append('- {}: {}{}'.format(key,safe(value),' ({}% of previous)'.format(rate) if rate is not None else ''))
        if key not in {'cooldown_excluded','db_duplicates_removed','category_saturation_excluded','novelty_excluded','winner_threshold_excluded','naver_web_result_count_calls'}: previous=value
    lines.append('- funnel_rates: '+safe(funnel.get('rates',{})))
    lines+=['- zero_result_recovery: '+safe(result['zero_result_recovery'])]
    lines+=['','## 검증 데이터 품질','',
            '- Search Ads 검색량이 붙은 신규 keyword: '+safe(result['new_search_ads_volume_count']),
            '- Naver web result status: '+safe(result['api_health'].get('NAVER_WEB_SEARCH','NOT_CONFIGURED')),
            '- Score invalid reasons: '+safe(result['score_invalid_reasons'])]
    for row in result['score_invalid_details']:
        lines.append('- {}: {}'.format(safe(row['keyword']),safe(row['missing'])))
    lines+=['','## DataLab quota','']
    for key in ['datalab_monthly_limit','datalab_used_this_month','datalab_remaining_quota','datalab_remaining_days','datalab_daily_budget','datalab_run_budget','datalab_actual_calls','datalab_validated_keywords','datalab_average_keywords_per_call']:
        lines.append('- {}: {}'.format(key,safe(result[key])))
    lines+=['','검색량은 월간 네이버 검색광고 수치. 광고 경쟁도는 SEO 경쟁 난이도의 대리 지표이며 수익 예측이 아니다.',
            '점수는 추정이며 결측을 0 검색량으로 표시하지 않는다. TOP은 적격 후보가 부족하면 짧아진다.','']
    for title,key in [('TOP 50 신규 키워드','top50'),('TOP 20 콘텐츠 후보','top20')]:
        lines+=['## '+title,'','|키워드|점수|신뢰도|월간 검색량|경쟁|태그|','|---|---:|---:|---:|---|---|']
        for row in result[key]:
            lines.append('|'+ '|'.join(safe(row.get(k)) for k in ['keyword','opportunity_score','confidence','monthly_total','competition','content_types'])+'|')
    lines+=['','## TOP 5 최우선 콘텐츠 후보','']
    for row in result['top5']:
        lines+=['### '+safe(row['keyword']),
                '- 점수 / 신뢰도: {} / {}'.format(row['opportunity_score'],row['confidence']),
                '- 검색 의도 / 추천 형식: {} / {}'.format(row['intent'],row['content_types']),
                '- 월간 검색량 / 광고 경쟁도: {} / {}'.format(safe(row.get('monthly_total')),safe(row.get('competition'))),
                '- 최근 추세 (1개월 / 3개월 변화율 %): {} / {}'.format(safe(row.get('trend_1m')),safe(row.get('trend_3m'))),
                '- 지금 검토할 이유: 명확한 {} 의도, 구체성 {:.2f}, freshness {:.2f}. 최신 사실 확인 후 작성.'.format(row['intent'],float(row['longtail_score']),float(row['freshness'])),
                '- 기존 사이트 차별점: {} 중복 판정. 가장 가까운 URL: {}. 세부 의도에 맞춘 독립 답변 가능성을 편집 검토.'.format(row['overlap'],safe(row.get('closest_url'))),'']
    lines+=['## CANDIDATE 10','']
    for row in result['candidate10']:
        lines.append('- {} — score {}, coverage {}, confidence {}'.format(safe(row['keyword']),safe(row.get('opportunity_score')),safe(row.get('data_coverage')),safe(row.get('confidence'))))
    lines+=['## 기존 페이지 업데이트 / 검토 대기','']
    for row in result['updates'][:50]: lines.append('- {} → {} ({})'.format(safe(row['keyword']),safe(row.get('closest_url')),row['action']))
    lines+=['','## 다음 확장 seed','',', '.join(result['next_seeds']) or '적격 seed 없음', '', '## API 오류 / 실패 seed','']
    for error in result['errors']: lines.append('- '+safe(error))
    if not result['errors']: lines.append('- 없음')
    return '\n'.join(lines)+'\n'

def health_check(root,client=None):
    root=Path(root).resolve()
    config=deepcopy(DEFAULT_CONFIG)
    overrides=read_json(root/'data/keyword_hunter_config.json',{})
    for key,value in overrides.items():
        if isinstance(config.get(key),dict): config[key].update(value)
        else: config[key]=value
    client=client or Client(config,usage_tracker=datalab_usage(root,config))
    pages=inventory(root)
    current=client.health()
    if current.get('NAVER_SEARCH_ADS')!='NOT_CONFIGURED': client.related('육아휴직')
    if current.get('NAVER_DATALAB')!='NOT_CONFIGURED': client.trends(['육아휴직'],datetime.now(KST).date())
    if current.get('NAVER_WEB_SEARCH')!='NOT_CONFIGURED' and hasattr(client,'web_result_count'): client.web_result_count('육아휴직')
    if config.get('rss_feeds'): client.feed(config['rss_feeds'][0])
    return {**client.health(),'SITE_INDEX':'OK' if pages else 'API_ERROR'}

def run(root,dry_run=False,offline=False,run_at=None,client=None,target=None,status_change=None,data_quality_only=False):
    root=Path(root).resolve();now=datetime.fromisoformat(run_at) if run_at else datetime.now(KST)
    if now.tzinfo is None: now=now.replace(tzinfo=KST)
    with (nullcontext() if dry_run else locked(root)):
        # History and persistent databases are read before discovery or API activity.
        history=(root/'PROJECT_HISTORY.md').read_text(encoding='utf-8') if (root/'PROJECT_HISTORY.md').exists() else '# PROJECT HISTORY\n'
        master=read_master(root); seed_data=read_json(root/'data/keyword_seeds.json',{'seeds':[]})
        exploration_history=read_json(root/'data/recent_exploration_history.json',{'runs':[]}).get('runs',[])[-10:]
        recovery=recovery_active(exploration_history)
        excluded_roots={normalize(x) for x in read_json(root/'data/seed_exclusions.json',{'roots':[]}).get('roots',[])}
        excluded_keywords=excluded_lineage_keys(master,excluded_roots)
        clusters=read_json(root/'data/keyword_clusters.json',{})
        rejected=read_json(root/'data/rejected_keywords.json',[])
        published=read_json(root/'data/published_keywords.json',[])
        config=deepcopy(DEFAULT_CONFIG); overrides=read_json(root/'data/keyword_hunter_config.json',{})
        for k,v in overrides.items():
            if isinstance(config.get(k),dict): config[k].update(v)
            else: config[k]=v
        if target is not None: config['target']=target
        if not 100<=config['target']<=500: raise ValueError('target must be 100..500')
        if not 0<config['category_share']<=1: raise ValueError('category_share must be 0..1')
        if config['max_depth']<1 or config['max_seeds']<1: raise ValueError('Invalid depth/seed budget')
        allocate(config['target'],config['exploration'])
        score({'keyword':'검증'},config)
        usage=datalab_usage(root,config,now)
        client=Client(config,offline=dry_run or offline,usage_tracker=usage) if dry_run or client is None else client
        api_health=client.health() if hasattr(client,'health') and isinstance(client.health(),dict) else {}
        pages=inventory(root); site=SiteIndex(pages)
        if status_change:
            keyword,status,url=status_change
            row=next((r for r in master if normalize(r['keyword'])==normalize(keyword)),None)
            if row is None: raise ValueError('Keyword not found')
            if status=='PUBLISHED' and (not url or not any(url in {p['url'],'/'+p['path'],p['canonical']} for p in pages)):
                raise ValueError('PUBLISHED requires an existing site URL')
            transition(row,status)
            if url: row['closest_url']=url
        # Reconcile persistent status registries; a published or rejected term cannot re-enter discovery.
        blocked={normalize(r['keyword']):'REJECTED' for r in rejected}
        blocked.update({normalize(r['keyword']):'PUBLISHED' for r in published})
        for row in master:
            if normalize(row['keyword']) in blocked and not (status_change and normalize(status_change[0])==normalize(row['keyword'])):
                row['status']=blocked[normalize(row['keyword'])]
        for row in master:
            row.update(score(row,config))
        old_categories={r['category'] for r in master}; old_clusters={r.get('cluster') for r in master}
        anchored_clusters={normalize(s['keyword']) for s in seed_data['seeds'] if s.get('source') in ANCHORED_SOURCES}|excluded_roots
        master_by_key={normalize(r['keyword']):r for r in master}
        pool={}
        for original in seed_data['seeds']:
            seed=dict(original); authoritative=master_by_key.get(normalize(seed['keyword']))
            if authoritative:
                if authoritative.get('parent_keyword'): seed['parent_keyword']=authoritative['parent_keyword']
                if authoritative.get('cluster'): seed['cluster']=authoritative['cluster']
            lineage={normalize(seed.get(k) or '') for k in ('keyword','parent_keyword','cluster')}
            if seed.get('source') in ANCHORED_SOURCES or lineage & anchored_clusters or normalize(seed['keyword']) in excluded_keywords: continue
            pool[normalize(seed['keyword'])]=seed
        external=[] if status_change or data_quality_only else external_seeds(root,client,config,now)
        expanded_external=recovery_seed_fragments(external)+external if recovery['active'] else external
        for s in expanded_external:
            key=normalize(s['keyword'])
            if key and key not in blocked: pool.setdefault(key,s)
        candidates=list(pool.values())
        for row in master:
            key=normalize(row['keyword'])
            lineage={normalize(row.get(k) or '') for k in ('keyword','parent_keyword','cluster')}
            if key not in pool and key not in excluded_keywords and row.get('status') not in {'REJECTED','PUBLISHED'} and not lineage & anchored_clusters:
                candidates.append({**row,'source':row.get('source') or 'historical_backlog',
                                   'bucket':row.get('exploration_bucket') or None})
        random_seed=int(now.timestamp())
        selection_diag={}
        selected=[] if status_change or data_quality_only else select_exploration_seeds(candidates,master,exploration_history,config['max_seeds'],random_seed,now,recovery=recovery['active'],diagnostics=selection_diag)
        counts=Counter(); cats=Counter(); generated_clusters=Counter()
        by_key={normalize(r['keyword']):r for r in master}; fresh=[]; duplicates=0
        funnel={'seeds_considered':len(candidates),'cooldown_excluded':0,**selection_diag,
                'seeds_queried':0,'raw_keywords':0,'normalized_keywords':0,
                'db_duplicates_removed':0,'category_saturation_excluded':0,'novelty_excluded':0,
                'naver_web_result_count_calls':0}; normalized_seen=set()
        def add(raw,seed,direct=False):
            nonlocal duplicates
            keyword=str(raw.get('keyword') or '').strip(); key=normalize(keyword)
            strategy=seed.get('strategy','longtail'); cat=seed.get('category') or category(keyword)
            if not key: return
            if key in blocked: duplicates+=1;funnel['db_duplicates_removed']+=1;return
            if key in by_key:
                duplicates+=1;funnel['db_duplicates_removed']+=1
                row=by_key[key]
                if raw.get('source')=='NAVER_SEARCHAD':
                    merge_validation_data(row,{k:v for k,v in raw.items() if k in {'monthly_pc','monthly_mobile','monthly_total','competition','volume_note','source_seed'}})
                    row['search_ads_checked_at']=now.isoformat();row['last_checked']=now.isoformat()
                return
            if api_health.get('NAVER_SEARCH_ADS')=='NOT_CONFIGURED' and api_health.get('NAVER_DATALAB')=='NOT_CONFIGURED':
                unverified=sum(r.get('confidence')=='UNVERIFIED' for r in by_key.values())
                if unverified>=config['max_unverified_candidates']: return
            cluster=seed.get('cluster') or normalize(seed['keyword'])
            if len(fresh)>=config['target'] or cats[cat]>=math.ceil(config['target']*config['category_share']) or generated_clusters[cluster]>=math.ceil(config['target']*.10):
                funnel['category_saturation_excluded']+=1; return
            if len(keyword)>80: return
            duplicate=next((r for r in by_key.values() if same_intent(keyword,r['keyword'])),None)
            if duplicate: duplicates+=1;funnel['db_duplicates_removed']+=1;return
            depth=int(seed.get('depth') or 0)+(0 if direct or key==normalize(seed['keyword']) else 1)
            if depth>config['max_depth']: return
            overlap=site.match(keyword)
            action=overlap['decision']
            if action=='REJECT': action='IMPROVE_EXISTING'
            row={**raw,'keyword':keyword,'parent_keyword':'' if direct or key==normalize(seed['keyword']) else seed['keyword'],
                 'cluster':cluster,'category':cat,'depth':depth,
                 'discovered_at':now.isoformat(),'last_checked':now.isoformat(),'status':'NEW','strategy':strategy,
                 'action':action,'closest_url':overlap.get('closestUrl'),'overlap':overlap['level'],
                 'reason':overlap['reason'],
                 'novelty_score':seed.get('novelty_score',0),'theme_state':'NEW',
                 'seed_source':seed.get('source') or 'unknown','exploration_bucket':seed.get('bucket') or 'backlog',
                 'search_ads_checked_at':now.isoformat() if raw.get('source')=='NAVER_SEARCHAD' else '',
                 'datalab_checked_at':''}
            row.update(score(row,config))
            if len(key)<4 or (row['intent']=='informational' and row['longtail_score']<.2):
                row.update(status='REJECTED',action='REJECT',reason='UNCLEAR_OR_BROAD_INTENT')
            by_key[key]=row;fresh.append(row);counts[strategy]+=1;cats[cat]+=1;generated_clusters[cluster]+=1
        for seed in selected:
            key=normalize(seed['keyword']); pool[key]=seed
            if seed_is_cached(seed,now,config['search_ads_cache_ttl_hours']): continue
            current_health=client.health() if hasattr(client,'health') and isinstance(client.health(),dict) else api_health
            blocked_health={'NOT_CONFIGURED','AUTH_ERROR','RATE_LIMITED','NETWORK_ERROR'}
            related=[] if current_health.get('NAVER_SEARCH_ADS') in blocked_health else client.related(seed['keyword'])
            if current_health.get('NAVER_SEARCH_ADS') not in blocked_health: funnel['seeds_queried']+=1
            funnel['raw_keywords']+=len(related)
            for raw in related:
                raw_key=normalize(raw.get('keyword',''))
                if raw_key: normalized_seen.add(raw_key)
            for raw in related: add(raw,seed)
            # Only externally observed words are fallback candidates; no fabricated suffix permutations.
            if seed.get('source') in {'PUBLIC_RSS','TREND_RADAR','EXISTING_EXTERNAL'}: add(seed,seed,direct=True)
            final_health=client.health() if hasattr(client,'health') and isinstance(client.health(),dict) else api_health
            seed['search_ads_status']=final_health.get('NAVER_SEARCH_ADS')
            if seed['search_ads_status']=='OK': seed['last_expanded']=now.isoformat()
        active=list(by_key.values())
        funnel['normalized_keywords']=len(normalized_seen)
        # Refresh older metrics only within the same global API call budget.
        due=[]
        for row in active:
            if row['status'] in {'REJECTED','PUBLISHED'}: continue
            if normalize(row['keyword']) in excluded_keywords or {normalize(row.get(k) or '') for k in ('keyword','parent_keyword','cluster')} & anchored_clusters: continue
            checked=row.get('search_ads_checked_at') or row.get('metrics_checked_at')
            if not checked or (now-datetime.fromisoformat(checked)).total_seconds()>=config['search_ads_cache_ttl_hours']*3600:
                due.append(row)
        due_rows=[] if data_quality_only or api_health.get('NAVER_SEARCH_ADS')=='NOT_CONFIGURED' else sorted(due,key=lambda r:-(number(r.get('opportunity_score')) or 0))[:20]
        for row in due_rows if not status_change else []:
            for raw in client.related(row['keyword']):
                if normalize(raw['keyword'])==normalize(row['keyword']):
                    merge_validation_data(row,{k:v for k,v in raw.items() if k!='keyword'});row['search_ads_checked_at']=now.isoformat();break
        trend_rows,fast_passed=fast_filter_rows([r for r in active if r['status'] not in {'REJECTED','PUBLISHED'} and normalize(r['keyword']) not in excluded_keywords and not ({normalize(r.get(k) or '') for k in ('keyword','parent_keyword','cluster')} & anchored_clusters)],fresh,now,config,recovery=recovery['active'])
        funnel['fast_filter_entered']=len(trend_rows);funnel['fast_filter_passed']=len(fast_passed)
        web_limit=max(20,min(50,int(config.get('web_result_validation_limit',50))))
        web_candidates=[]
        for row in fast_passed[:web_limit]:
            checked=row.get('result_count_checked_at')
            if checked:
                try:
                    if (now-datetime.fromisoformat(checked)).total_seconds()<config.get('web_result_cache_ttl_hours',168)*3600: continue
                except ValueError: pass
            web_candidates.append(row)
        if not status_change and not data_quality_only and api_health.get('NAVER_WEB_SEARCH') not in {None,'NOT_CONFIGURED'}:
            for row in web_candidates:
                total=client.web_result_count(row['keyword'])
                if total is not None:
                    monthly=number(row.get('monthly_total'))
                    merge_validation_data(row,{'web_result_count':total,
                        'demand_supply_ratio':round(monthly/max(total,1),8) if monthly is not None else None,
                        'competition_ratio':round(total/max(monthly,1),2) if monthly is not None else None,
                        'result_count_checked_at':now.isoformat()})
                health=client.health()
                if health.get('NAVER_WEB_SEARCH') in {'AUTH_ERROR','RATE_LIMITED','NETWORK_ERROR','API_ERROR'}: break
        submitted_trend_list=[r['keyword'] for r in fast_passed[:250]]
        trends=client.trends(submitted_trend_list,now.date()) if not status_change and not data_quality_only and api_health.get('NAVER_DATALAB')!='NOT_CONFIGURED' else {}
        for row in active:
            if row['keyword'] in trends:
                merge_validation_data(row,trends[row['keyword']]); row['datalab_checked_at']=now.isoformat()
            checked=row.get('search_ads_checked_at') or row.get('metrics_checked_at')
            if checked and (now-datetime.fromisoformat(checked)).total_seconds()>config['search_ads_cache_ttl_hours']*3600:
                for k in ['monthly_pc','monthly_mobile','monthly_total','competition']: row[k]=None
            row.update(score(row,config))
            overlap=site.match(row['keyword']);row.update(overlap=overlap['level'],last_checked=now.isoformat())
            if row['status']!='PUBLISHED': row['closest_url']=overlap.get('closestUrl')
            if row['status'] not in {'REJECTED','PUBLISHED'}: row['action']='IMPROVE_EXISTING' if overlap['decision']=='REJECT' else overlap['decision']
        initial_eligible=sorted([r for r in fresh if r['status']=='NEW' and r['action']=='NEW_PAGE' and r['score_valid']],key=lambda r:(-r['opportunity_score'],r['keyword']))
        initial_winners=[r for r in initial_eligible if r['opportunity_score']>=config['min_score'] and r['confidence'] in {'HIGH','MEDIUM'}]
        fresh,dropped_by_saturation=enforce_candidate_shares(fresh,initial_winners)
        funnel['category_saturation_excluded']+=len(dropped_by_saturation)
        for row in dropped_by_saturation: by_key.pop(normalize(row['keyword']),None)
        active=list(by_key.values())
        eligible=sorted([r for r in fresh if r['status']=='NEW' and r['action']=='NEW_PAGE' and r['score_valid']],key=lambda r:(-r['opportunity_score'],r['keyword']))
        top50=diverse(eligible,50,config['category_share'])
        top20=diverse([r for r in eligible if r['opportunity_score']>=config['min_score'] and r['confidence'] in {'HIGH','MEDIUM'}],20,config['category_share'])
        winners=top20
        current_candidates=[r for r in fresh if r['status']=='NEW' and r['action']=='NEW_PAGE' and r['score_valid']]
        fallback_candidates=sorted([r for r in active if r['status']=='NEW' and r.get('action')=='NEW_PAGE' and r.get('score_valid')],key=lambda r:(-(number(r.get('opportunity_score')) or 0),r['keyword']))[:10]
        candidate10=fallback_candidates if recovery['winner_zero_streak']>=3 else []
        winner_clusters={r['cluster'] for r in winners}
        for row in active:
            if row['cluster'] in winner_clusters:
                row['theme_state']='EXPERIMENT_THEME' if row.get('theme_state') in {'','NEW',None} else row['theme_state']
        recent_seed_keys={normalize(s.get('keyword','')) for run in exploration_history for s in run.get('seeds',[])}
        selected_keys={normalize(s['keyword']) for s in selected}
        overlap_count=len(selected_keys & recent_seed_keys)
        category_counts=Counter(r['category'] for r in fresh); source_counts=Counter(s.get('source') or 'unknown' for s in selected)
        pct=lambda count,total: round(100*count/total,2) if total else 0.0
        funnel.update({'novelty_passed':max(0,funnel['normalized_keywords']-funnel['db_duplicates_removed']-funnel['category_saturation_excluded']),
                       'datalab_verified':getattr(client,'datalab_keywords_validated',0) if isinstance(getattr(client,'datalab_keywords_validated',0),(int,float)) else len(trends),
                       'naver_web_result_count_calls':getattr(client,'web_result_calls',0) if isinstance(getattr(client,'web_result_calls',0),(int,float)) else 0,
                       'score_valid_count':len(current_candidates),'winner_threshold_excluded':max(0,len(current_candidates)-len(winners)),
                       'candidate_count':len(current_candidates),'winner_count':len(winners)})
        def rate(value,base): return round(100*value/base,2) if base else 0.0
        after_cooldown=max(0,funnel['seeds_considered']-funnel['cooldown_excluded'])
        after_duplicates=max(0,funnel['normalized_keywords']-funnel['db_duplicates_removed'])
        funnel['rates']={'cooldown_drop_pct':rate(funnel['cooldown_excluded'],funnel['seeds_considered']),
                         'seed_query_pct':rate(funnel['seeds_queried'],after_cooldown),
                         'normalization_pass_pct':rate(funnel['normalized_keywords'],funnel['raw_keywords']),
                         'duplicate_drop_pct':rate(funnel['db_duplicates_removed'],funnel['normalized_keywords']),
                         'category_saturation_drop_pct':rate(funnel['category_saturation_excluded'],after_duplicates),
                         'novelty_pass_pct':rate(funnel['novelty_passed'],after_duplicates),
                         'fast_filter_pass_pct':rate(funnel['fast_filter_passed'],funnel['fast_filter_entered']),
                         'datalab_verification_pct':rate(funnel['datalab_verified'],funnel['fast_filter_passed']),
                         'score_valid_pct':rate(funnel['score_valid_count'],funnel['fast_filter_passed']),
                         'winner_pct':rate(funnel['winner_count'],funnel['candidate_count'])}
        entry={'run_id':now.isoformat(),'random_seed':random_seed,'recovery':recovery,'discovery_funnel':funnel,
               'seeds':[{k:s.get(k) for k in ('keyword','category','cluster','source','bucket','novelty_score')} for s in selected],
               'categories':sorted({s.get('category') for s in selected if s.get('category')}),
               'clusters':sorted({s.get('cluster') for s in selected if s.get('cluster')}),
               'keywords':[r['keyword'] for r in fresh],
               'failed_seeds':[e.get('seed') for e in client.errors],
               'winners':[{k:r.get(k) for k in ('keyword','category','cluster','opportunity_score','exploration_bucket')} for r in winners]}
        history_after=update_history(exploration_history,entry)
        cooled=cooldown_clusters(history_after)
        next_candidates=[s for s in candidates if not seed_is_cached(s,now,config['search_ads_cache_ttl_hours'])]
        next_selected=select_exploration_seeds(next_candidates,active,history_after,config['max_seeds'],random_seed+1,now,recovery=recovery['active'])
        next_directions=[]
        for s in next_selected:
            direction=(s.get('category') if s.get('category') not in old_categories else None) or s.get('cluster') or s.get('keyword')
            if direction and direction not in next_directions: next_directions.append(direction)
            if len(next_directions)>=10: break
        quota=usage.snapshot()
        datalab_calls=getattr(client,'datalab_calls',0)
        validated=getattr(client,'datalab_keywords_validated',0)
        datalab_calls=datalab_calls if isinstance(datalab_calls,(int,float)) else 0
        validated=validated if isinstance(validated,(int,float)) else 0
        submitted=getattr(client,'datalab_keywords_submitted',validated)
        submitted=submitted if isinstance(submitted,(int,float)) else validated
        invalid_details=[{'keyword':r['keyword'],'missing':r.get('score_invalid_reasons','')} for r in fresh if not r.get('score_valid')]
        invalid_counts=Counter(reason for row in invalid_details for reason in row['missing'].split('|') if reason)
        invalid_counts={key:invalid_counts.get(key,0) for key in
                        ('monthly_volume_missing','competition_missing','trend_missing','web_result_missing')}
        improvement_data=select_improvement_candidates(read_json(root/'data'/'page-performance.json',{}))
        result={'target':config['target'],'seeds_checked':len(selected),'new_keywords':len(fresh),'duplicates':duplicates,
                'rejected':sum(r['status']=='REJECTED' for r in fresh),'db_total':len(active),'api_calls':client.calls,
                'rate_limits':client.rate_limits,'errors':client.errors,'api_health':client.health() if hasattr(client,'health') and isinstance(client.health(),dict) else api_health,'strategy_counts':dict(counts),'new_categories':sorted({r['category'] for r in fresh}-old_categories),
                'shortfall':config['target']-len(fresh),'missing_data':dict(Counter(k for r in fresh for k in ['monthly_total','competition','trend_1m','trend_3m'] if r.get(k) in ('',None))),
                'existing_page_improvement_candidates':improvement_data['candidateCount'],
                'site_pages':len(pages),'top50':top50,'top20':top20,'top5':diverse(top20,5,config['category_share']),
                'updates':[r for r in active if r.get('action') in {'IMPROVE_EXISTING','WAIT_FOR_DATA'}],
                'next_seeds':[s['keyword'] for s in next_selected[:10]],
                'exploration_candidates':len(candidates),'new_seed_count':sum(s.get('bucket')=='new_theme' for s in selected),
                'repeated_seed_count':overlap_count,'recent_seed_overlap':pct(overlap_count,len(selected_keys)),
                'new_category_count':len({r['category'] for r in fresh}-old_categories),
                'new_cluster_count':len({r['cluster'] for r in fresh}-old_clusters),
                'novelty_ratio':pct(sum(s.get('bucket')=='new_theme' for s in selected),len(selected)),
                'category_shares':{k:pct(v,len(fresh)) for k,v in sorted(category_counts.items())},
                'source_shares':{k:pct(v,len(selected)) for k,v in sorted(source_counts.items())},
                'winner_count':len(winners),'new_theme_winners':[r['keyword'] for r in winners if r.get('exploration_bucket')=='new_theme'],
                'cooldown_clusters':cooled,'next_exploration_directions':next_directions,'random_seed':random_seed,
                'discovery_funnel':funnel,'zero_result_recovery':recovery,'candidate10':candidate10,
                'new_search_ads_volume_count':sum((number(r.get('monthly_total')) or 0)>0 for r in fresh),
                'score_invalid_reasons':invalid_counts,'score_invalid_details':invalid_details,
                'datalab_monthly_limit':quota['monthly_limit'],'datalab_used_this_month':quota['used_this_month'],
                'datalab_remaining_quota':quota['remaining_quota'],'datalab_remaining_days':quota['remaining_days'],
                'datalab_daily_budget':quota['daily_budget'],'datalab_run_budget':usage.allocated_run_budget,
                'datalab_actual_calls':datalab_calls,'datalab_validated_keywords':validated,
                'datalab_average_keywords_per_call':round(submitted/datalab_calls,2) if datalab_calls else 0.0}
        output=report(result,now); result['report_text']=output
        if not dry_run:
            report_path='reports/keyword-hunter/'+now.strftime('%Y-%m-%d-%H%M')+'.md'
            # Same-minute invocations append sections to retain every run in the required pathname.
            existing=(root/report_path).read_text() if (root/report_path).exists() else ''
            cluster_map={}
            for row in active:
                cluster_map.setdefault(row['cluster'],{'category':row['category'],'keywords':[],'edges':[]})
                cluster_map[row['cluster']]['keywords'].append(row['keyword'])
                if row['parent_keyword']: cluster_map[row['cluster']]['edges'].append([row['parent_keyword'],row['keyword']])
            for s in next_selected: pool.setdefault(normalize(s['keyword']),s)
            # Preserve manually registered blocked terms even when absent from master.
            def registry(old,status):
                rows={normalize(r['keyword']):r for r in old}
                for r in active:
                    key=normalize(r['keyword'])
                    if r['status']==status: rows[key]={'keyword':r['keyword'],'url':r.get('closest_url'),'reason':r.get('reason'),'at':now.isoformat()}
                    else: rows.pop(key,None)
                return list(rows.values())
            summary='\n## {} Keyword Hunter\n- Seeds: {}; New: {}; Rejected: {}; DB: {}; Errors: {}; Top: {}. Report: {}\n'.format(now.strftime('%Y-%m-%d %H:%M'),len(selected),len(fresh),result['rejected'],len(active),len(client.errors),result['top5'][0]['keyword'] if result['top5'] else 'none',report_path)
            files={'data/keywords_master.csv':csv_text(active),'data/keyword_seeds.json':json_text({'seeds':list(pool.values())}),
                   'data/keyword_clusters.json':json_text(cluster_map),'data/rejected_keywords.json':json_text(registry(rejected,'REJECTED')),
                   'data/published_keywords.json':json_text(registry(published,'PUBLISHED')),report_path:existing+output,
                   'data/recent_exploration_history.json':json_text({'runs':history_after}),
                   'data/existing-page-improvement-candidates.json':json_text(improvement_data),
                   'PROJECT_HISTORY.md':history+summary}
            commit(root,files);result['report_path']=report_path
        return result

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    parser.add_argument('--dry-run',action='store_true',help='No writes or API calls')
    parser.add_argument('--offline',action='store_true',help='Use local sources; persist results')
    parser.add_argument('--target',type=int)
    parser.add_argument('--health-check',action='store_true')
    parser.add_argument('--data-quality-only',action='store_true',help='Migrate/reclassify existing rows without discovery or API calls')
    parser.add_argument('--set-status',choices=['REVIEWED','QUEUED','PUBLISHED','REJECTED'])
    parser.add_argument('--keyword');parser.add_argument('--url')
    args=parser.parse_args()
    try:
        load_env_file(args.root)
        if args.health_check:
            for name,status in health_check(args.root).items(): print('{}: {}'.format(name,status))
            return 0
        if args.set_status and not args.keyword: raise ValueError('--keyword required')
        result=run(args.root,dry_run=args.dry_run,offline=args.offline,target=args.target,
                   status_change=(args.keyword,args.set_status,args.url) if args.set_status else None,
                   data_quality_only=args.data_quality_only)
        print(result['report_text'] if args.dry_run else json.dumps({k:result[k] for k in ['new_keywords','db_total','api_calls','shortfall','existing_page_improvement_candidates','report_path']},ensure_ascii=False))
        return 0
    except (OSError,ValueError,KeyError,TypeError) as e:
        # Never serialize API headers, secret values, or raw responses.
        print('Keyword Hunter stopped safely: '+type(e).__name__+'; check configuration/database/lock. No automatic reset.',file=sys.stderr)
        return 1

if __name__=='__main__': sys.exit(main())
