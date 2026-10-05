"""Small, fail-closed helpers for supervised publication bookkeeping."""

try:
    from scripts.content_launch_policy import DAILY_PUBLICATION_LIMIT
except ModuleNotFoundError:
    from content_launch_policy import DAILY_PUBLICATION_LIMIT

REQUIRED_GATES = frozenset({"tests", "guard", "seo", "pages", "live"})
def can_complete_publication(completed_gates):
    return REQUIRED_GATES.issubset(set(completed_gates or ()))
def record_publication(published, counter, keyword, url, date, daily_limit=DAILY_PUBLICATION_LIMIT):
    entries=[dict(x) for x in (published or [])]
    if any(x.get("keyword")==keyword and x.get("url")==url for x in entries):
        return entries,dict(counter or {})
    entries.append({"keyword":keyword,"url":url})
    current=dict(counter or {})
    limit=max(0,int(daily_limit))
    try:
        count=max(0,int(current.get("launchedCount",0))) if current.get("date")==date else 0
    except (TypeError,ValueError):
        count=limit if current.get("date")==date else 0
    current.update({"date":date,"launchedCount":count+1,"dailyLimit":limit})
    return entries,current
