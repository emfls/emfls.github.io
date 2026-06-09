#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gemini 출력(PDF 또는 텍스트)을 읽어 emfls.com 컬럼 HTML 페이지 생성
"""

import os, re, json
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PDF_FILE   = os.path.join(SCRIPT_DIR, ".gemini_output.pdf")
TXT_FILE   = os.path.join(SCRIPT_DIR, ".gemini_output.txt")
YT_FILE    = os.path.join(SCRIPT_DIR, ".yt_response.txt")
RESULT_FILE = os.path.join(SCRIPT_DIR, ".last_result")
OUT_DIR    = os.path.join(SCRIPT_DIR, "kor", "column")

GA_ID    = "G-QP5Q67GE5B"
ADSENSE  = "ca-pub-8830524482034754"
SITE_URL = "https://emfls.com"

def read_content():
    """PDF 또는 텍스트에서 본문 추출"""
    if os.path.exists(PDF_FILE):
        try:
            import pdfplumber
            with pdfplumber.open(PDF_FILE) as pdf:
                return "\n".join(p.extract_text() or "" for p in pdf.pages)
        except ImportError:
            pass
        try:
            import PyPDF2
            reader = PyPDF2.PdfReader(PDF_FILE)
            return "\n".join(p.extract_text() or "" for p in reader.pages)
        except Exception:
            pass

    if os.path.exists(TXT_FILE):
        return open(TXT_FILE, encoding="utf-8").read()

    if os.path.exists(YT_FILE):
        return open(YT_FILE, encoding="utf-8").read()

    return None

def slugify(text):
    text = re.sub(r'[^\w\s가-힣]', '', text.lower())
    text = re.sub(r'\s+', '-', text.strip())
    # 한글 → 영문 변환 (간단 매핑)
    ko_en = {'가':'ga','나':'na','다':'da','라':'ra','마':'ma','바':'ba','사':'sa',
             '아':'a','자':'ja','차':'cha','카':'ka','타':'ta','파':'pa','하':'ha'}
    result = ""
    for c in text:
        result += ko_en.get(c, c)
    result = re.sub(r'[^a-z0-9\-]', '', result)
    result = re.sub(r'-+', '-', result).strip('-')
    return result[:60] or "column"

def extract_title_and_sections(content):
    """본문에서 제목과 섹션 파싱"""
    lines = [l.strip() for l in content.split('\n') if l.strip()]

    title = ""
    sections = []
    current_section = None

    for line in lines:
        # 제목 후보: 첫 번째 굵은 줄 또는 가장 짧고 임팩트 있는 줄
        if not title and len(line) < 60 and not line.startswith('#'):
            title = line
            continue

        # 섹션 헤더 감지 (##, **, 숫자. 으로 시작)
        if re.match(r'^(#{1,3}|[\*]{2}|\d+\.)\s', line) or (len(line) < 50 and line.endswith(('다', '요', '까', '죠'))):
            if current_section:
                sections.append(current_section)
            clean = re.sub(r'^[#\*\d\.\s]+', '', line).strip()
            current_section = {"heading": clean, "body": []}
        elif current_section is not None:
            current_section["body"].append(line)
        else:
            if sections:
                sections[-1]["body"].append(line)

    if current_section:
        sections.append(current_section)

    # 제목이 없으면 첫 섹션 제목 사용
    if not title and sections:
        title = sections[0]["heading"]
        sections = sections[1:]

    return title, sections

def sections_to_html(sections):
    html = ""
    for sec in sections:
        if not sec.get("heading") and not sec.get("body"):
            continue
        body_html = ""
        for line in sec.get("body", []):
            if not line:
                continue
            # 리스트 아이템 감지
            if re.match(r'^[-•·▶→✔✅]\s', line):
                body_html += f'<li>{line[2:].strip()}</li>'
            else:
                body_html += f'<p>{line}</p>'

        # li 태그를 ul로 감싸기
        if '<li>' in body_html:
            body_html = re.sub(r'(<li>.*?</li>)+', lambda m: f'<ul>{m.group()}</ul>', body_html, flags=re.DOTALL)

        heading = sec.get("heading", "")
        if heading:
            html += f'<div class="section"><h2>{heading}</h2>{body_html}</div>\n'
        else:
            html += f'<div class="section">{body_html}</div>\n'
    return html

def build_html(title, sections_html, slug, content):
    today = datetime.now().strftime("%Y년 %m월 %d일")
    canonical = f"{SITE_URL}/kor/column/{slug}.html"

    # 간단 description 추출 (첫 단락)
    desc_match = re.search(r'<p>(.{20,120})</p>', sections_html)
    description = desc_match.group(1) if desc_match else title

    return f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<script async src="https://www.googletagmanager.com/gtag/js?id={GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','{GA_ID}');</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE}" crossorigin="anonymous"></script>
<title>{title} | emfls.com</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{canonical}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{canonical}">
<meta property="og:type" content="article">
<script type="application/ld+json">
{{"@context":"https://schema.org","@type":"Article",
"headline":"{title}","description":"{description}",
"datePublished":"{datetime.now().strftime('%Y-%m-%d')}",
"dateModified":"{datetime.now().strftime('%Y-%m-%d')}",
"url":"{canonical}","author":{{"@type":"Organization","name":"emfls.com"}}}}
</script>
<style>
*{{margin:0;padding:0;box-sizing:border-box;}}
body{{font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#0d1117;color:#e6edf3;line-height:1.8;}}
.wrap{{max-width:800px;margin:0 auto;padding:20px 16px 60px;}}
.site-header{{background:linear-gradient(90deg,#4e54c8,#8f94fb);padding:14px 24px;
  display:flex;align-items:center;justify-content:space-between;margin-bottom:0;}}
.site-header .logo{{color:#fff;font-weight:800;font-size:1.1rem;text-decoration:none;}}
header.hero{{background:linear-gradient(135deg,#1a1f2e,#161b22);border:1px solid #30363d;
  border-radius:14px;padding:48px 28px 40px;text-align:center;margin:24px 0;}}
header.hero h1{{font-size:1.7rem;font-weight:800;line-height:1.35;margin-bottom:12px;
  background:linear-gradient(90deg,#e6edf3,#58a6ff);-webkit-background-clip:text;
  -webkit-text-fill-color:transparent;background-clip:text;}}
.meta{{color:#6e7681;font-size:.85rem;margin-top:8px;}}
.intro-box{{background:#161b22;border:1px solid #30363d;border-radius:12px;
  padding:20px 24px;margin-bottom:24px;font-size:.97rem;color:#c9d1d9;
  border-left:4px solid #58a6ff;line-height:1.85;}}
.section{{background:#161b22;border:1px solid #21262d;border-radius:12px;
  padding:24px;margin-bottom:20px;}}
.section h2{{font-size:1.08rem;color:#58a6ff;margin-bottom:14px;
  border-bottom:1px solid #21262d;padding-bottom:10px;font-weight:700;}}
.section p{{color:#c9d1d9;font-size:.95rem;margin-bottom:12px;line-height:1.85;}}
.section ul{{padding-left:20px;margin-bottom:12px;}}
.section li{{color:#c9d1d9;font-size:.95rem;margin-bottom:6px;line-height:1.7;}}
.breadcrumb{{font-size:.8rem;color:#484f58;margin-bottom:16px;}}
.breadcrumb a{{color:#58a6ff;text-decoration:none;}}
footer{{text-align:center;padding:28px 16px;color:#484f58;font-size:.8rem;border-top:1px solid #21262d;margin-top:40px;}}
footer a{{color:#58a6ff;text-decoration:none;}}
.cp-notice{{font-size:.75rem;color:#484f58;text-align:center;margin-top:16px;}}
@media(max-width:600px){{header.hero h1{{font-size:1.3rem;}}}}
</style>
</head>
<body>
<div class="site-header">
  <a class="logo" href="{SITE_URL}">emfls.com</a>
</div>
<div class="wrap">
  <div class="breadcrumb">
    <a href="{SITE_URL}">홈</a> › <a href="{SITE_URL}/kor/column/">칼럼</a> › {title[:30]}
  </div>

  <header class="hero">
    <h1>{title}</h1>
    <div class="meta">✍️ emfls.com &nbsp;|&nbsp; 📅 {today}</div>
  </header>

  <div class="intro-box">{description}</div>

  {sections_html}

  <div class="cp-notice">
    이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
  </div>
</div>
<footer>
  <p>© 2026 <a href="{SITE_URL}">emfls.com</a> | AI·경제·테크 인사이트 칼럼</p>
  <p style="margin-top:6px"><a href="{SITE_URL}/kor/column/">← 칼럼 목록으로</a></p>
</footer>
<script src="/js/coupang-loader.js" defer></script>
</body>
</html>"""

def main():
    content = read_content()
    if not content:
        print("처리할 콘텐츠 없음")
        return

    print(f"콘텐츠 길이: {len(content)}자")

    title, sections = extract_title_and_sections(content)
    if not title:
        title = f"인사이트 칼럼 {datetime.now().strftime('%Y%m%d')}"

    print(f"제목: {title}")
    print(f"섹션 수: {len(sections)}")

    sections_html = sections_to_html(sections)
    date_str = datetime.now().strftime("%Y%m%d")
    slug = f"{slugify(title)}-{date_str}"

    html = build_html(title, sections_html, slug, content)

    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f"{slug}.html")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)

    page_url = f"https://emfls.com/kor/column/{slug}.html"
    open(RESULT_FILE, "w").write(page_url)

    print(f"저장: {out_path}")
    print(f"URL: {page_url}")

if __name__ == "__main__":
    main()
