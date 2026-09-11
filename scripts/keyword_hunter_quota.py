"""Persistent, KST-aware quota accounting for NAVER API HUB Data Lab."""
import calendar
import fcntl
import json
import math
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

KST=timezone(timedelta(hours=9))


class QuotaExhausted(Exception):
    pass


class DataLabUsage:
    def __init__(self,root,monthly_limit=50000,reserve_ratio=.10,runs_per_day=12,now=None):
        self.root=Path(root)
        self.path=self.root/'data/api_usage.json'
        self.lock_path=self.root/'.keyword-hunter/api-usage.lock'
        self.monthly_limit=max(0,int(monthly_limit))
        self.reserve_ratio=min(1,max(0,float(reserve_ratio)))
        self.runs_per_day=max(1,int(runs_per_day))
        self.now=now or (lambda:datetime.now(KST))
        self.run_calls=0
        self._initial_run_budget=self._calculate(self._read(),self._kst_now())['run_budget']

    @property
    def allocated_run_budget(self): return self._initial_run_budget

    def _kst_now(self):
        value=self.now()
        if value.tzinfo is None: value=value.replace(tzinfo=KST)
        return value.astimezone(KST)

    def _read(self):
        if not self.path.exists(): return {'service':'NAVER_API_HUB_DATALAB_SEARCH_TREND','months':{}}
        try: return json.loads(self.path.read_text(encoding='utf-8'))
        except (ValueError,OSError): return {'service':'NAVER_API_HUB_DATALAB_SEARCH_TREND','months':{}}

    def _write(self,data):
        self.path.parent.mkdir(parents=True,exist_ok=True)
        temporary=self.path.with_name(self.path.name+'.tmp')
        with temporary.open('w',encoding='utf-8') as handle:
            json.dump(data,handle,ensure_ascii=False,indent=2); handle.write('\n'); handle.flush(); os.fsync(handle.fileno())
        os.replace(temporary,self.path)

    def _calculate(self,data,now):
        month=now.strftime('%Y-%m'); day=now.date().isoformat()
        bucket=data.get('months',{}).get(month,{})
        used=int(bucket.get('calls',0)); used_today=int(bucket.get('days',{}).get(day,0))
        usable=math.floor(self.monthly_limit*(1-self.reserve_ratio))
        remaining=max(0,usable-used)
        remaining_days=calendar.monthrange(now.year,now.month)[1]-now.day+1
        daily=remaining/remaining_days if remaining_days else 0
        interval=24/self.runs_per_day
        remaining_runs=max(1,math.ceil((24-(now.hour+now.minute/60+now.second/3600))/interval))
        run_budget=max(0,math.floor(max(0,daily-used_today)/remaining_runs))
        return {'monthly_limit':self.monthly_limit,'reserve_ratio':self.reserve_ratio,
                'usable_budget':usable,'used_this_month':used,'remaining_quota':remaining,
                'remaining_days':remaining_days,'daily_budget':round(daily,2),'used_today':used_today,
                'remaining_runs_today':remaining_runs,'run_budget':run_budget,'actual_calls':self.run_calls}

    def snapshot(self): return self._calculate(self._read(),self._kst_now())

    def can_call(self):
        snap=self.snapshot()
        return snap['remaining_quota']>0 and self.run_calls<self._initial_run_budget

    def record_attempt(self):
        self.lock_path.parent.mkdir(parents=True,exist_ok=True)
        with self.lock_path.open('a') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX)
            try:
                now=self._kst_now(); data=self._read(); snap=self._calculate(data,now)
                if snap['remaining_quota']<=0 or self.run_calls>=self._initial_run_budget:
                    raise QuotaExhausted('DATALAB_BUDGET')
                month=now.strftime('%Y-%m'); day=now.date().isoformat()
                months=data.setdefault('months',{}); bucket=months.setdefault(month,{'calls':0,'days':{}})
                bucket['calls']=int(bucket.get('calls',0))+1
                days=bucket.setdefault('days',{}); days[day]=int(days.get(day,0))+1
                bucket['updated_at']=now.isoformat(); self._write(data); self.run_calls+=1
            finally: fcntl.flock(lock,fcntl.LOCK_UN)
