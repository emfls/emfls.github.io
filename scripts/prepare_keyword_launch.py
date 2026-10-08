"""Convert Keyword Hunter rows into a bounded launch queue; never publishes HTML."""
import argparse, csv, json
from pathlib import Path
from datetime import datetime
try:
    from scripts.content_launch_policy import (
        DAILY_PUBLICATION_LIMIT,
        SEOUL,
        publication_day,
        publication_manifest_count,
        normalize_keyword,
        published_manifest_dedupe_keys,
        select_launch_candidate,
    )
except ModuleNotFoundError:
    from content_launch_policy import (
        DAILY_PUBLICATION_LIMIT,
        SEOUL,
        publication_day,
        publication_manifest_count,
        normalize_keyword,
        published_manifest_dedupe_keys,
        select_launch_candidate,
    )
try:
    from scripts.content_url_planner import plan_url
except ModuleNotFoundError:
    from content_url_planner import plan_url
try:
    from scripts.content_launch_decisions import load_decisions
except ModuleNotFoundError:
    from content_launch_decisions import load_decisions

def prepare_queue(rows, existing_urls=None, published_keywords=None, daily_limit=DAILY_PUBLICATION_LIMIT, selected_at=None, launched_count=0, counter_date=None, editorial_decisions=None, published_manifest=None):
    selected_day = publication_day(selected_at) if selected_at else datetime.now(SEOUL).date()
    counter_count = 0
    if publication_day(counter_date) == selected_day:
        try:
            counter_count = max(0, int(launched_count))
        except (TypeError, ValueError):
            counter_count = 0
    manifest_count = publication_manifest_count(published_manifest, selected_day, daily_limit)
    effective_count = max(counter_count, manifest_count)
    manifest_urls, manifest_keywords = published_manifest_dedupe_keys(published_manifest)
    existing_urls = set(existing_urls or set()) | manifest_urls
    published_keywords = set(published_keywords or set()) | manifest_keywords
    derived=[]; held=0; no_new_page=0; update_existing=0
    if isinstance(editorial_decisions,list):
        decisions={normalize_keyword(x.get('keyword')):x.get('decision') for x in editorial_decisions if isinstance(x,dict)}
    else:
        decisions={normalize_keyword(k):v for k,v in (editorial_decisions or {}).items()}
    for row in rows:
        item=dict(row)
        decision=decisions.get(normalize_keyword(item.get('keyword')))
        if decision == 'HOLD':
            held += 1; continue
        if decision == 'NO_NEW_PAGE':
            no_new_page += 1; continue
        if decision == 'UPDATE_EXISTING':
            update_existing += 1; continue
        if item.get('action','NEW_PAGE') == 'NEW_PAGE' and not item.get('suggested_url'):
            item['suggested_url']=plan_url(item.get('keyword'),item.get('category'),item.get('content_types'),item.get('intent'))
        derived.append(item)
    reviewed_ymyl_keywords={keyword for keyword, decision in decisions.items() if decision == 'APPROVE'}
    result=select_launch_candidate(derived, existing_urls, published_keywords, daily_limit, selected_at, launched_count=effective_count, reviewed_ymyl_keywords=reviewed_ymyl_keywords)
    result['excluded']['editorial_hold']=held
    result['excluded']['no_new_page']=no_new_page
    result['excluded']['update_existing']=update_existing
    result['publishedToday']=effective_count
    result['remainingCapacity']=max(0, int(daily_limit)-effective_count)
    return result

def main():
    p=argparse.ArgumentParser(); p.add_argument('--root',type=Path,default=Path('.')); p.add_argument('--selected-at',default=datetime.now(SEOUL).isoformat()); args=p.parse_args()
    with (args.root/'data/keywords_master.csv').open(encoding='utf-8',newline='') as f: rows=list(csv.DictReader(f))
    index=json.loads((args.root/'data/content-index-ko.json').read_text(encoding='utf-8')) if (args.root/'data/content-index-ko.json').exists() else []
    published=json.loads((args.root/'data/published_keywords.json').read_text(encoding='utf-8')) if (args.root/'data/published_keywords.json').exists() else []
    decisions=load_decisions(args.root/'data/content-launch-decisions.json')
    counter=json.loads((args.root/'data/content-launch-counter.json').read_text(encoding='utf-8')) if (args.root/'data/content-launch-counter.json').exists() else {}
    manifest=json.loads((args.root/'data/content-launch-manifest.json').read_text(encoding='utf-8')) if (args.root/'data/content-launch-manifest.json').exists() else {}
    result=prepare_queue(rows,{r.get('url') for r in index},{r.get('keyword') for r in published},DAILY_PUBLICATION_LIMIT,args.selected_at,int(counter.get('launchedCount',0)),counter.get('date'),decisions,manifest)
    out=args.root/'data/content-launch-queue.json'
    payload={'schemaVersion':1,'selectedAt':args.selected_at,**result}
    if out.exists():
        try:
            previous=json.loads(out.read_text(encoding='utf-8'))
            material=lambda x: {k:v for k,v in x.items() if k not in {'selectedAt','selected_at'}}
            if material(previous) == material(payload):
                payload['selectedAt']=previous.get('selectedAt', args.selected_at)
        except (OSError, ValueError, TypeError):
            pass
    out.write_text(json.dumps(payload,ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf-8'); print(json.dumps({'queue':len(result['queue']),'excluded':result['excluded']},ensure_ascii=False))
if __name__=='__main__': main()
