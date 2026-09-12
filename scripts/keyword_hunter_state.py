"""Recoverable multi-file state writes protected by an OS process lock."""
import csv
import fcntl
import io
import json
import os
from contextlib import contextmanager
from pathlib import Path
try:
    from scripts.keyword_hunter_core import FIELDS, normalize, TRANSITIONS
except ModuleNotFoundError:
    from keyword_hunter_core import FIELDS, normalize, TRANSITIONS

def read_json(path,default):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default

def read_master(root):
    path=root/'data/keywords_master.csv'
    if not path.exists(): return []
    with path.open(encoding='utf-8',newline='') as f:
        reader=csv.DictReader(f)
        if not {'keyword','status'}.issubset(reader.fieldnames or []): raise ValueError('Invalid master schema')
        rows=list(reader)
    for row in rows:
        for field in FIELDS: row.setdefault(field,'')
    keys=set()
    for row in rows:
        key=normalize(row['keyword'])
        if not key or key in keys or row['status'] not in TRANSITIONS: raise ValueError('Invalid/duplicate master row')
        keys.add(key)
    return rows

def csv_text(rows):
    output=io.StringIO();writer=csv.DictWriter(output,FIELDS,extrasaction='ignore',lineterminator='\n');writer.writeheader();writer.writerows(rows)
    return output.getvalue()

def json_text(value): return json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n'

def atomic(path,text):
    path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_name(path.name+'.tmp')
    with temporary.open('w',encoding='utf-8') as f:
        f.write(text);f.flush();os.fsync(f.fileno())
    os.replace(temporary,path)

def commit(root,files):
    journal=root/'.keyword-hunter/transaction.json'
    atomic(journal,json_text(files))
    recover(root)

def recover(root):
    journal=root/'.keyword-hunter/transaction.json'
    if journal.exists():
        files=read_json(journal,{})
        for name,text in files.items():
            path=(root/name).resolve()
            if root.resolve() not in path.parents: raise ValueError('Invalid recovery path')
            atomic(path,text)
        journal.unlink()

@contextmanager
def locked(root):
    folder=root/'.keyword-hunter';folder.mkdir(exist_ok=True)
    with (folder/'run.lock').open('a') as f:
        try: fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError: raise ValueError('Keyword Hunter already running') from None
        try:
            recover(root);yield
        finally: fcntl.flock(f,fcntl.LOCK_UN)
