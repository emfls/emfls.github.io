"""Breadth-first, reproducible seed exploration policy."""
import math
import random
import re
from collections import Counter
from difflib import SequenceMatcher

from scripts.keyword_hunter_core import normalize, number


BUCKET_RATIOS={"new_theme":40,"promising":30,"winner":20,"backlog":10}
RECOVERY_BUCKET_RATIOS={"new_theme":70,"promising":15,"winner":10,"backlog":5}
ANCHORED_SOURCES={"INITIAL_SITE_FIT","INITIAL_EXPLORATION"}


def exploration_budgets(total,ratios=None):
    ratios=ratios or BUCKET_RATIOS
    raw={k:total*v/100 for k,v in ratios.items()}
    result={k:int(v) for k,v in raw.items()}
    for key in sorted(raw,key=lambda k:(-(raw[k]-result[k]),k))[:total-sum(result.values())]:
        result[key]+=1
    return result


def _recent_items(history,key):
    return [item for run in history[-10:] for item in run.get(key,[])]


def novelty_score(seed,master,history):
    keyword=normalize(seed.get("keyword","")); category=seed.get("category") or "other"
    cluster=seed.get("cluster") or keyword
    master_categories={r.get("category") for r in master}
    master_clusters={r.get("cluster") for r in master}
    recent=_recent_items(history,"seeds")
    recent_keys={normalize(r.get("keyword","")) for r in recent}
    recent_categories={r.get("category") for r in recent}
    recent_clusters={r.get("cluster") for r in recent}
    comparisons=[normalize(r.get("keyword","")) for r in master]
    similarity=max((SequenceMatcher(None,keyword,other).ratio() for other in comparisons if other),default=0)
    score=55-35*similarity
    if category not in master_categories: score+=20
    if cluster not in master_clusters: score+=15
    if category not in recent_categories: score+=10
    if cluster not in recent_clusters: score+=10
    if keyword in recent_keys: score-=45
    category_size=sum(r.get("category")==category for r in master)
    score-=min(20,category_size/5)
    return round(max(0,min(100,score)),2)


def _bucket(seed,master,winner_clusters):
    if seed.get("bucket") in BUCKET_RATIOS: return seed["bucket"]
    cluster=seed.get("cluster") or normalize(seed.get("keyword",""))
    if cluster in winner_clusters: return "winner"
    matching=next((r for r in master if normalize(r.get("keyword",""))==normalize(seed.get("keyword",""))),None)
    if matching and not matching.get("score_valid"): return "backlog"
    if not matching: return "new_theme"
    return "promising"


def recovery_active(history):
    def streak(key):
        count=0
        for run in reversed(history[-10:]):
            if run.get(key): break
            count+=1
        return count
    new_zero=streak('keywords'); winner_zero=streak('winners'); latest=history[-1] if history else {}
    funnel=latest.get('discovery_funnel',{}); considered=funnel.get('seeds_considered',0)
    cooldown_ratio=funnel.get('cooldown_excluded',0)/considered if considered else 0
    raw=funnel.get('normalized_keywords',0); duplicate_ratio=funnel.get('db_duplicates_removed',0)/raw if raw else 0
    entered=funnel.get('fast_filter_entered',0); fast_ratio=funnel.get('fast_filter_passed',0)/entered if entered else 1
    reasons=[]
    if new_zero>=2: reasons.append('NEW_KEYWORD_ZERO_STREAK')
    if winner_zero>=3: reasons.append('WINNER_ZERO_STREAK')
    if cooldown_ratio>.50: reasons.append('COOLDOWN_MAJORITY')
    if duplicate_ratio>=.80: reasons.append('DUPLICATE_RATE_80')
    if fast_ratio<.02: reasons.append('FAST_FILTER_BELOW_2_PERCENT')
    active=bool(reasons)
    return {'active':active,'new_zero_streak':new_zero,'winner_zero_streak':winner_zero,
            'new_theme_ratio':70 if active else 40,'cooldown_ratio':round(cooldown_ratio,4),
            'duplicate_ratio':round(duplicate_ratio,4),'fast_filter_ratio':round(fast_ratio,4),'reasons':reasons}


def recovery_seed_fragments(seeds):
    """Make breadth-first seeds solely from words already present in observed titles."""
    result=[]; seen=set()
    for seed in seeds:
        words=re.findall(r'[가-힣A-Za-z0-9]+',str(seed.get('keyword','')))
        for size in (2,3):
            for start in range(max(0,len(words)-size+1)):
                phrase=' '.join(words[start:start+size]); compact=normalize(phrase)
                if len(compact)<4 or len(compact)>20 or compact in seen: continue
                seen.add(compact)
                result.append({**seed,'keyword':phrase,'category':'recovery:'+normalize(words[start]),'cluster':compact,'source':'ZERO_RECOVERY_EXTERNAL_FRAGMENT',
                               'bucket':'new_theme','strategy':'discovery','depth':0})
    return result


def select_exploration_seeds(candidates,master,history,total,random_seed,now,recovery=False,diagnostics=None):
    winner_clusters={r.get("cluster") for r in _recent_items(history,"winners")}
    recent_seeds={normalize(r.get("keyword","")) for r in _recent_items(history,"seeds")}
    recent_clusters={r.get("cluster") for run in history[-2:] for r in run.get("seeds",[])}
    prepared=[]
    excluded_recent_seed=0; excluded_recent_cluster=0; anchored=0
    for original in candidates:
        if original.get("source") in ANCHORED_SOURCES: anchored+=1; continue
        seed=dict(original); seed.setdefault("cluster",normalize(seed.get("keyword","")))
        seed["bucket"]=_bucket(seed,master,winner_clusters)
        seed["novelty_score"]=novelty_score(seed,master,history)
        key=normalize(seed.get("keyword",""))
        if key in recent_seeds: excluded_recent_seed+=1; continue
        if seed["cluster"] in recent_clusters and seed["cluster"] not in winner_clusters: excluded_recent_cluster+=1; continue
        prepared.append(seed)
    if diagnostics is not None:
        diagnostics.update({'seeds_considered':len(candidates),'anchored_excluded':anchored,
                            'recent_seed_excluded':excluded_recent_seed,'recent_cluster_excluded':excluded_recent_cluster,
                            'cooldown_excluded':excluded_recent_seed+excluded_recent_cluster,'seed_pool_after_cooldown':len(prepared)})
    rng=random.Random(random_seed); budgets=exploration_budgets(total,RECOVERY_BUCKET_RATIOS if recovery else None)
    chosen=[]; used=set(); cats=Counter(); clusters=Counter(); sources=Counter()
    category_cap=max(1,math.floor(total*.20)); cluster_cap=max(1,math.floor(total*.10))
    source_counts=Counter(s.get('source') or 'unknown' for s in prepared)
    if len(source_counts)>1:
        largest=max(source_counts.values()); alternatives=sum(source_counts.values())-largest
        source_cap=max(1,min(math.floor(total*.50),alternatives))
    else: source_cap=total
    def take(pool,count):
        ranked=sorted(pool,key=lambda s:(-(number(s.get("opportunity_score")) or 0),-s["novelty_score"],s["keyword"]))
        top_count=math.ceil(count*.70); ordered=ranked[:top_count]
        remainder=ranked[top_count:]
        rng.shuffle(remainder); ordered+=sorted(remainder,key=lambda s:-s["novelty_score"])
        for seed in ordered:
            if len([x for x in chosen if x["bucket"]==seed["bucket"]])>=count: break
            key=normalize(seed["keyword"])
            source=seed.get('source') or 'unknown'
            if key in used or cats[seed.get("category","other")]>=category_cap or clusters[seed["cluster"]]>=cluster_cap or sources[source]>=source_cap: continue
            chosen.append(seed);used.add(key);cats[seed.get("category","other")]+=1;clusters[seed["cluster"]]+=1;sources[source]+=1
    for bucket,count in budgets.items(): take([s for s in prepared if s["bucket"]==bucket],count)
    if len(chosen)<total:
        remainder=[s for s in prepared if normalize(s["keyword"]) not in used]
        # Extra capacity goes to novel themes first, so 40% is a floor rather than a ceiling.
        remainder.sort(key=lambda s:(s["bucket"]!="new_theme",-s["novelty_score"],s["keyword"]))
        for seed in remainder:
            if len(chosen)>=total: break
            source=seed.get('source') or 'unknown'
            if cats[seed.get("category","other")]>=category_cap or clusters[seed["cluster"]]>=cluster_cap or sources[source]>=source_cap: continue
            chosen.append(seed);used.add(normalize(seed["keyword"]));cats[seed.get("category","other")]+=1;clusters[seed["cluster"]]+=1;sources[source]+=1
    return chosen


def update_history(history,entry):
    return (list(history)+[entry])[-10:]


def cooldown_clusters(history):
    recent=history[-3:]
    seen=Counter(r.get("cluster") for run in recent for r in run.get("seeds",[]) if r.get("cluster"))
    winners={r.get("cluster") for run in recent for r in run.get("winners",[])}
    return sorted(cluster for cluster,count in seen.items() if cluster not in winners and count>=2)


def enforce_candidate_shares(rows,winners,default_cap=.20,winner_cap=.30):
    kept=list(rows); dropped=[]
    if len({r.get('category') or 'other' for r in kept}) < math.ceil(1/default_cap):
        return kept,dropped
    winner_keys={normalize(r.get('keyword','')) for r in winners}
    winner_categories={r.get('category') for r in winners}
    while kept:
        counts=Counter(r.get('category') or 'other' for r in kept); total=len(kept)
        violations=[cat for cat,count in counts.items() if count/total > (winner_cap if cat in winner_categories else default_cap)]
        if not violations: break
        cat=max(violations,key=lambda c:counts[c]/(winner_cap if c in winner_categories else default_cap))
        removable=[r for r in kept if (r.get('category') or 'other')==cat]
        removable.sort(key=lambda r:(normalize(r.get('keyword','')) in winner_keys,
                                     number(r.get('opportunity_score')) or 0,r.get('keyword','')))
        victim=removable[0];kept.remove(victim);dropped.append(victim)
    return kept,dropped
