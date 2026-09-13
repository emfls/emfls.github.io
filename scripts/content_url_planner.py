"""Deterministic, offline URL planning for launch candidates."""
import re

_INITIAL = ('g','gg','n','d','dd','r','m','b','bb','s','ss','', 'j','jj','c','k','t','p','h')
_MEDIAL = ('a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','weo','we','wi','yu','eu','ui','i')
_FINAL = ('','g','gg','gs','n','nj','nh','d','l','lg','lm','lb','ls','lt','lp','lh','m','b','bs','s','ss','ng','j','c','k','t','p','h')

def _romanize(text):
    out=[]
    for ch in str(text or '').casefold():
        code=ord(ch)
        if 0xAC00 <= code <= 0xD7A3:
            n=code-0xAC00; out.append(_INITIAL[n//588]+_MEDIAL[(n%588)//28]+_FINAL[n%28])
        elif ch.isascii() and ch.isalnum(): out.append(ch)
        elif ch.isspace() or ch in '-_': out.append('-')
    slug=re.sub(r'-+','-', ''.join(out)).strip('-')
    return slug or 'content'

def plan_url(keyword, category='', content_types='', intent=''):
    text='|'.join(str(x or '').casefold() for x in (category,content_types,intent))
    route='util' if any(x in text for x in ('calculator','tool','계산기','도구')) else 'game' if any(x in text for x in ('game','게임')) else 'column'
    return f'/kor/{route}/{_romanize(keyword)}/'
