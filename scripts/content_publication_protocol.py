"""Small, fail-closed helpers for supervised publication bookkeeping."""
REQUIRED_GATES = frozenset({"tests", "guard", "seo", "pages", "live"})
def can_complete_publication(completed_gates):
    return REQUIRED_GATES.issubset(set(completed_gates or ()))
def record_publication(published, counter, keyword, url, date):
    entries=[dict(x) for x in (published or [])]
    if not any(x.get("keyword")==keyword and x.get("url")==url for x in entries): entries.append({"keyword":keyword,"url":url})
    current=dict(counter or {}); limit=int(current.get("dailyLimit",1)); count=int(current.get("launchedCount",0)) if current.get("date")==date else 0
    if count < limit: current.update({"date":date,"launchedCount":count+1,"dailyLimit":limit})
    return entries,current
