"""Current static-site inventory and conservative lexical intent matching."""
import json
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse, unquote
try:
    from scripts.seo_audit import PageParser, _public_url, _category
    from scripts.new_content_opportunity import classify_overlap
    from scripts.keyword_hunter_core import normalize, grams, similarity
except ModuleNotFoundError:
    from seo_audit import PageParser, _public_url, _category
    from new_content_opportunity import classify_overlap
    from keyword_hunter_core import normalize, grams, similarity

class HeadingParser(PageParser):
    def __init__(self):
        super().__init__(); self.headings=[]; self.heading=None
    def handle_starttag(self,tag,attrs):
        super().handle_starttag(tag,attrs)
        if tag in {'h1','h2','h3','h4','h5','h6'}: self.heading=[]
    def handle_data(self,data):
        super().handle_data(data)
        if self.heading is not None: self.heading.append(data)
    def handle_endtag(self,tag):
        super().handle_endtag(tag)
        if tag in {'h1','h2','h3','h4','h5','h6'} and self.heading is not None:
            self.headings.append(' '.join(''.join(self.heading).split()));self.heading=None

def inventory(root):
    root=Path(root); pages=[]
    metadata_path=root/'data/content-metadata.json'
    metadata=json.loads(metadata_path.read_text()) if metadata_path.exists() else []
    by_path={urlparse(r.get('url','')).path:r for r in metadata}
    for path in sorted(root.rglob('*.html')):
        rel=path.relative_to(root)
        if any(x.startswith('.') or x in {'node_modules','sources','reports','docs','py','dist'} for x in rel.parts): continue
        parser=HeadingParser(); parser.feed(path.read_text(encoding='utf-8')); parser.close()
        meta=by_path.get('/'+rel.as_posix(),{})
        pages.append({'url':_public_url(rel),'canonical':parser.canonical,'path':rel.as_posix(),
                      'title':' '.join(''.join(parser.title_parts).split()),'headings':parser.headings,
                      'target_query':meta.get('target_query',''),'category':_category(rel)})
    return pages

class SiteIndex:
    def __init__(self,pages):
        self.entries=[];self.inverted=defaultdict(set);self.exact=defaultdict(list)
        for page in pages:
            texts=[page.get('title',''),page.get('target_query','')]+page.get('headings',[])
            texts.append(unquote(urlparse(page['url']).path).replace('-',' ').replace('/',' '))
            for text in texts:
                if len(normalize(text))<4: continue
                idx=len(self.entries);self.entries.append((text,page['url']))
                self.exact[normalize(text)].append(idx)
                for gram in grams(text): self.inverted[gram].add(idx)
    def match(self,keyword):
        key=normalize(keyword)
        if key in self.exact:
            text,url=self.entries[self.exact[key][0]]
            return classify_overlap({'targetIntent':key,'goalRelation':'SAME_GOAL'}, {'url':url,'targetIntent':key})
        candidates=set()
        for gram in grams(keyword): candidates.update(self.inverted.get(gram,()))
        best=0;closest=None
        for idx in candidates:
            text,url=self.entries[idx]; value=similarity(keyword,text)
            # Keyword fully covered by an existing heading/title is an update opportunity.
            other=normalize(text)
            if len(key)>=6 and key in other: value=max(value,.9)
            if value>best: best=value;closest={'url':url,'targetIntent':normalize(text)}
        return classify_overlap({'targetIntent':key,'semanticSimilarity':best},closest)
