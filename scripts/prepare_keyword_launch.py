"""Convert Keyword Hunter rows into a bounded launch queue; never publishes HTML."""
import argparse, csv, json
from pathlib import Path
from datetime import datetime, timezone
try:
    from scripts.content_launch_policy import select_launch_candidate
except ModuleNotFoundError:
    from content_launch_policy import select_launch_candidate

def prepare_queue(rows, existing_urls=None, published_keywords=None, daily_limit=1, selected_at=None, launched_count=0):
    return select_launch_candidate(rows, existing_urls, published_keywords, daily_limit, selected_at, launched_count=launched_count)

def main():
    p=argparse.ArgumentParser(); p.add_argument('--root',type=Path,default=Path('.')); p.add_argument('--selected-at',default=datetime.now(timezone.utc).isoformat()); args=p.parse_args()
    with (args.root/'data/keywords_master.csv').open(encoding='utf-8',newline='') as f: rows=list(csv.DictReader(f))
    index=json.loads((args.root/'data/content-index-ko.json').read_text(encoding='utf-8')) if (args.root/'data/content-index-ko.json').exists() else []
    published=json.loads((args.root/'data/published_keywords.json').read_text(encoding='utf-8')) if (args.root/'data/published_keywords.json').exists() else []
    counter=json.loads((args.root/'data/content-launch-counter.json').read_text(encoding='utf-8')) if (args.root/'data/content-launch-counter.json').exists() else {}
    result=prepare_queue(rows,{r.get('url') for r in index},{r.get('keyword') for r in published},int(counter.get('dailyLimit',1)),args.selected_at,int(counter.get('launchedCount',0)))
    out=args.root/'data/content-launch-queue.json'; out.write_text(json.dumps({'schemaVersion':1,'selectedAt':args.selected_at,**result},ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf-8'); print(json.dumps({'queue':len(result['queue']),'excluded':result['excluded']},ensure_ascii=False))
if __name__=='__main__': main()
