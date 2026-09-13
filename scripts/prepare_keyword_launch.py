"""Convert Keyword Hunter rows into a bounded launch queue; never publishes HTML."""
import argparse, csv, json
from pathlib import Path
from datetime import datetime, timezone
try:
    from scripts.content_launch_policy import select_launch_candidate
except ModuleNotFoundError:
    from content_launch_policy import select_launch_candidate
try:
    from scripts.content_url_planner import plan_url
except ModuleNotFoundError:
    from content_url_planner import plan_url
try:
    from scripts.content_launch_decisions import load_decisions
except ModuleNotFoundError:
    from content_launch_decisions import load_decisions

def prepare_queue(rows, existing_urls=None, published_keywords=None, daily_limit=1, selected_at=None, launched_count=0, counter_date=None, editorial_decisions=None):
    effective_count = launched_count if counter_date and selected_at and str(counter_date) == str(selected_at)[:10] else 0
    derived=[]; held=0
    if isinstance(editorial_decisions,list):
        decisions={''.join(ch for ch in str(x.get('keyword','')).casefold() if ch.isalnum()):x.get('decision') for x in editorial_decisions if isinstance(x,dict)}
    else: decisions=editorial_decisions or {}
    for row in rows:
        item=dict(row)
        if decisions.get(''.join(ch for ch in str(item.get('keyword','')).casefold() if ch.isalnum())) == 'HOLD':
            held += 1; continue
        if item.get('action','NEW_PAGE') == 'NEW_PAGE' and not item.get('suggested_url'):
            item['suggested_url']=plan_url(item.get('keyword'),item.get('category'),item.get('content_types'),item.get('intent'))
        derived.append(item)
    result=select_launch_candidate(derived, existing_urls, published_keywords, daily_limit, selected_at, launched_count=effective_count)
    result['excluded']['editorial_hold']=held
    return result

def main():
    p=argparse.ArgumentParser(); p.add_argument('--root',type=Path,default=Path('.')); p.add_argument('--selected-at',default=datetime.now(timezone.utc).isoformat()); args=p.parse_args()
    with (args.root/'data/keywords_master.csv').open(encoding='utf-8',newline='') as f: rows=list(csv.DictReader(f))
    index=json.loads((args.root/'data/content-index-ko.json').read_text(encoding='utf-8')) if (args.root/'data/content-index-ko.json').exists() else []
    published=json.loads((args.root/'data/published_keywords.json').read_text(encoding='utf-8')) if (args.root/'data/published_keywords.json').exists() else []
    decisions=load_decisions(args.root/'data/content-launch-decisions.json')
    counter=json.loads((args.root/'data/content-launch-counter.json').read_text(encoding='utf-8')) if (args.root/'data/content-launch-counter.json').exists() else {}
    result=prepare_queue(rows,{r.get('url') for r in index},{r.get('keyword') for r in published},int(counter.get('dailyLimit',1)),args.selected_at,int(counter.get('launchedCount',0)),counter.get('date'),decisions)
    out=args.root/'data/content-launch-queue.json'; out.write_text(json.dumps({'schemaVersion':1,'selectedAt':args.selected_at,**result},ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf-8'); print(json.dumps({'queue':len(result['queue']),'excluded':result['excluded']},ensure_ascii=False))
if __name__=='__main__': main()
