"""
노지캠핑 특집 페이지 생성기
- 도(道) 단위 지역별 모음 페이지
- 테마별 페이지 (무료, 차박, 바다뷰 등)
- 세부 명소 페이지
"""
from pathlib import Path
from datetime import datetime

REPO_ROOT = Path(__file__).parent.parent
OUTPUT_DIR = REPO_ROOT / "kor/report/camp"
SITE_URL = "https://emfls.com"

GA_ID = "G-QP5Q67GE5B"
ADSENSE_ID = "ca-pub-8830524482034754"

def html_head(title, description, keywords, slug, geo_region="KR"):
    today = datetime.now().strftime("%Y-%m-%d")
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <meta name="description" content="{description}">
    <meta name="keywords" content="{keywords}">
    <meta name="robots" content="index, follow">
    <meta name="author" content="노지캠핑 가이드">
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{description}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="{SITE_URL}/kor/report/camp/{slug}.html">
    <link rel="canonical" href="{SITE_URL}/kor/report/camp/{slug}.html">
    <script type="application/ld+json">
    {{
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "{title}",
        "description": "{description}",
        "author": {{"@type": "Organization", "name": "노지캠핑 가이드"}},
        "publisher": {{"@type": "Organization", "name": "emfls.com", "url": "https://emfls.com"}},
        "datePublished": "{today}",
        "dateModified": "{today}",
        "inLanguage": "ko"
    }}
    </script>
    <script async src="https://www.googletagmanager.com/gtag/js?id={GA_ID}"></script>
    <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','{GA_ID}');</script>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE_ID}" crossorigin="anonymous"></script>
    <style>
        *{{margin:0;padding:0;box-sizing:border-box;}}
        body{{font-family:'Noto Sans KR',sans-serif;background:linear-gradient(135deg,#a8e6cf,#88d8c0);min-height:100vh;color:#333;line-height:1.7;}}
        .container{{max-width:1100px;margin:0 auto;padding:20px;}}
        header{{background:rgba(255,255,255,.95);border-radius:15px;padding:30px;text-align:center;margin-bottom:28px;box-shadow:0 8px 30px rgba(0,0,0,.1);}}
        header h1{{color:#2c3e50;font-size:2rem;margin-bottom:10px;line-height:1.3;}}
        header p{{color:#7f8c8d;font-size:1rem;}}
        .intro{{background:rgba(255,255,255,.9);border-radius:12px;padding:22px 26px;margin-bottom:22px;box-shadow:0 4px 15px rgba(0,0,0,.08);}}
        .intro p{{font-size:.97rem;color:#444;margin-bottom:10px;}}
        .spots-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px;margin-bottom:24px;}}
        .spot-card{{background:white;border-radius:14px;padding:22px;box-shadow:0 6px 20px rgba(0,0,0,.09);border-left:5px solid #a8e6cf;}}
        .spot-card h2{{color:#2c3e50;font-size:1.25rem;margin-bottom:8px;}}
        .spot-card .location{{font-size:.82rem;color:#27ae60;font-weight:600;margin-bottom:8px;}}
        .spot-card p{{font-size:.9rem;color:#555;margin-bottom:10px;}}
        .tags{{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}}
        .tag{{background:#e8f5e9;color:#2e7d32;border-radius:20px;padding:3px 11px;font-size:.78rem;font-weight:500;}}
        .tag.blue{{background:#e3f2fd;color:#1565c0;}}
        .tag.orange{{background:#fff3e0;color:#e65100;}}
        .related-links{{background:rgba(255,255,255,.92);border-radius:12px;padding:20px 24px;margin-bottom:20px;box-shadow:0 4px 15px rgba(0,0,0,.07);}}
        .related-links h3{{color:#2c3e50;font-size:1rem;margin-bottom:12px;}}
        .links-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;}}
        .links-grid a{{background:#f0fdf4;color:#16a34a;border-radius:8px;padding:7px 12px;font-size:.84rem;text-decoration:none;font-weight:500;border:1px solid #bbf7d0;display:block;text-align:center;}}
        .links-grid a:hover{{background:#dcfce7;}}
        .tips-box{{background:rgba(255,255,255,.9);border-radius:12px;padding:20px 24px;margin-bottom:20px;border-left:5px solid #f39c12;box-shadow:0 4px 15px rgba(0,0,0,.07);}}
        .tips-box h3{{color:#d35400;margin-bottom:12px;font-size:1rem;}}
        .tips-box ul{{padding-left:18px;}}
        .tips-box li{{font-size:.9rem;color:#555;margin-bottom:6px;}}
        .breadcrumb{{font-size:.82rem;color:#555;margin-bottom:14px;}}
        .breadcrumb a{{color:#27ae60;text-decoration:none;}}
        footer{{background:rgba(255,255,255,.8);border-radius:10px;text-align:center;padding:16px;color:#888;font-size:.8rem;margin-top:10px;}}
        footer a{{color:#27ae60;}}
        @media(max-width:600px){{header h1{{font-size:1.5rem;}}.spots-grid{{grid-template-columns:1fr;}}}}
    </style>
</head>
<body>
<div class="container">
    <div class="breadcrumb"><a href="{SITE_URL}">홈</a> &rsaquo; <a href="{SITE_URL}/kor/report/camp/index.html">노지캠핑</a> &rsaquo; {title[:20]}...</div>
"""

def html_foot(related_camps):
    links = "".join(f'<a href="{SITE_URL}/kor/report/camp/{s}.html">{n}</a>' for s, n in related_camps)
    return f"""
    <div class="related-links">
        <h3>🗺️ 다른 지역 노지캠핑 가이드</h3>
        <div class="links-grid">{links}</div>
    </div>
    <footer><p>© 2025 emfls.com | <a href="{SITE_URL}">홈</a> · <a href="{SITE_URL}/kor/report/camp/index.html">캠핑 전체보기</a></p>
    <p style="margin-top:4px;">본 정보는 참고용이며 방문 전 현지 확인을 권장합니다. 최종 업데이트: {datetime.now().strftime('%Y-%m-%d')}</p></footer>
</div>
</body>
</html>"""


PAGES = [
    # ── 도(道) 단위 모음 ──────────────────────────────────────────
    {
        "slug": "gyeonggi-best",
        "title": "경기도 노지캠핑 명소 BEST 10 | 수도권 차박 성지 완전정복 2025",
        "description": "경기도 노지캠핑 핫플 10곳 총정리! 김포 전류리포구, 가평 북한강, 양평 두물머리, 파주 임진강 등 수도권에서 1시간 이내 최고의 무료 차박 성지를 소개합니다.",
        "keywords": "경기도 노지캠핑,수도권 차박,경기도 무료 캠핑,김포 노지캠핑,가평 차박,양평 캠핑,파주 노지캠핑,경기도 캠핑 명소",
        "geo": "KR-41",
        "intro": "서울에서 1~2시간 거리, 경기도는 수도권 캠퍼들의 성지입니다. 한강과 북한강, 남한강을 따라 펼쳐진 절경 속 노지캠핑 명소 10곳을 엄선했습니다.",
        "spots": [
            {"name": "김포 전류리포구", "location": "경기도 김포시", "desc": "한강 하구에 자리한 김포 대표 무료 차박지. 일출과 일몰이 압도적이며 강 너머 북한 땅이 보이는 독특한 풍경이 인상적입니다. 조강랜드, 문수골 힐링캠핑장과 함께 묶어서 방문하기 좋습니다.", "tags": ["무료","한강뷰","일출명소","차박"]},
            {"name": "가평 북한강 캠핑지", "location": "경기도 가평군", "desc": "청평호와 북한강이 만나는 가평은 수도권 최고의 캠핑 성지입니다. 대성리, 청평, 가평읍 일대에 계곡과 강변 노지 포인트가 즐비합니다.", "tags": ["강변","계곡","수상레저","차박"]},
            {"name": "양평 두물머리", "location": "경기도 양평군", "desc": "남한강과 북한강이 만나는 두물머리는 이른 아침 물안개와 함께하는 일출로 유명합니다. 세미원 인근 강변 포인트에서 하룻밤 캠핑이 가능합니다.", "tags": ["강뷰","일출","포토스팟"]},
            {"name": "파주 임진강 차박지", "location": "경기도 파주시", "desc": "임진강변을 따라 황포돛배 선착장, 율곡습지공원 등 다양한 차박 포인트가 있습니다. 민통선 인근 특별한 분위기의 캠핑이 가능합니다.", "tags": ["임진강","역사","무료","차박"]},
            {"name": "여주 남한강 모래사장", "location": "경기도 여주시", "desc": "여주 세종대왕 유적지 인근 남한강 백사장은 강변 차박의 성지입니다. 강물 소리 들으며 모래사장에서의 하룻밤은 특별한 경험입니다.", "tags": ["모래사장","강변","차박"]},
            {"name": "양주 불곡산 인근", "location": "경기도 양주시", "desc": "양주 장흥유원지와 불곡산 등산로 인근에 조용한 캠핑 포인트가 있습니다. 서울 근교 산악 노지캠핑을 즐길 수 있는 접근성 좋은 명소입니다.", "tags": ["산악","숲속","근교"]},
            {"name": "연천 한탄강 현무암 협곡", "location": "경기도 연천군", "desc": "한탄강 국가지질공원의 현무암 협곡을 배경으로 캠핑을 즐길 수 있는 특별한 명소입니다. 재인폭포, 태풍전망대 인근 포인트가 인기입니다.", "tags": ["지질공원","협곡","한탄강","차박"]},
            {"name": "안성 고삼저수지", "location": "경기도 안성시", "desc": "고삼저수지 주변은 잉어낚시와 함께 노지캠핑을 즐기기 좋은 경기 남부의 숨은 명소입니다. 주말에도 비교적 한산해 여유로운 캠핑이 가능합니다.", "tags": ["저수지","낚시","조용함"]},
            {"name": "포천 백운계곡", "location": "경기도 포천시", "desc": "포천 백운계곡은 수도권 최고의 계곡 캠핑지 중 하나입니다. 맑은 계곡물과 울창한 산림이 어우러져 여름철 피서 캠핑지로 각광받고 있습니다.", "tags": ["계곡","여름피서","청정수"]},
            {"name": "남양주 북한강 물의정원", "location": "경기도 남양주시", "desc": "북한강변 물의정원 인근은 자전거길과 함께 강변 노지캠핑을 즐길 수 있는 수도권 대표 명소입니다. 서울에서 40분 거리의 뛰어난 접근성이 장점입니다.", "tags": ["북한강","자전거","근교","차박"]},
        ],
        "tips": ["경기도 차박은 주말 오전 일찍 출발해야 좋은 자리를 잡을 수 있습니다", "임진강·한강변 일부 구역은 야영 금지 구역이 있으니 현지 안내판을 반드시 확인하세요", "봄(4~5월)과 가을(9~10월)이 경기도 노지캠핑 최적 시즌입니다", "화로대 사용 시 화재 예방에 각별히 주의하고 완전히 소화 후 이동하세요"],
        "related": [("gimpo","김포"), ("gapyeong","가평"), ("yangpyeong","양평"), ("paju","파주"), ("yeoncheon","연천"), ("namyangju","남양주"), ("icheon","이천"), ("anseong","안성")],
    },
    {
        "slug": "gangwon-best",
        "title": "강원도 노지캠핑 성지 BEST 12 | 바다·계곡·산 완전정복 2025",
        "description": "강원도 노지캠핑 최고 명소 12곳! 속초 영금정, 강릉 안목해변, 삼척 장호항, 정선 동강, 양양 남애항 등 바다부터 계곡, 산까지 강원도 캠핑의 모든 것을 담았습니다.",
        "keywords": "강원도 노지캠핑,강원도 차박,속초 차박,강릉 노지캠핑,양양 캠핑,정선 노지캠핑,삼척 캠핑,동해 차박,강원도 캠핑 성지",
        "geo": "KR-42",
        "intro": "동해바다부터 백두대간 계곡, 한강 발원지까지 — 강원도는 대한민국 최고의 노지캠핑 천국입니다. 바다·계곡·산 세 가지 테마로 12개 명소를 소개합니다.",
        "spots": [
            {"name": "속초 영금정·외옹치 해변", "location": "강원도 속초시", "desc": "속초의 숨은 보석, 영금정 앞 바다뷰 차박지. 외옹치 바다향기 테마길 인근 해변에서 파도 소리를 들으며 캠핑을 즐길 수 있습니다. 속초 아바이마을과 함께 방문 추천.", "tags": ["바다뷰","해변","차박","동해"]},
            {"name": "강릉 안목해변·남항진", "location": "강원도 강릉시", "desc": "커피거리로 유명한 안목해변 남쪽 남항진 해변은 강릉 최고의 차박 명소입니다. 일출과 함께 즐기는 모닝 커피 한 잔이 압권입니다.", "tags": ["일출","바다","커피","차박"]},
            {"name": "양양 남애항·하조대", "location": "강원도 양양군", "desc": "서핑의 성지 양양! 남애항과 하조대 인근 해변에서 서퍼들의 열기를 느끼며 캠핑을 즐길 수 있습니다. 낙산해수욕장도 가깝습니다.", "tags": ["서핑","해변","바다뷰","여름"]},
            {"name": "삼척 장호항·초곡항", "location": "강원도 삼척시", "desc": "한국의 나폴리로 불리는 장호항. 투명한 에메랄드빛 바다와 스노클링, 해상어드벤처를 즐기며 캠핑까지 가능한 강원도 최고의 숨은 명소입니다.", "tags": ["에메랄드해","스노클링","차박","인스타"]},
            {"name": "정선 동강 절벽", "location": "강원도 정선군", "desc": "동강래프팅 성지 정선. 어라연 계곡과 동강 절벽을 배경으로 하는 캠핑은 강원도에서도 손에 꼽히는 절경입니다. 래프팅과 함께 1박 2일 코스 추천.", "tags": ["동강","래프팅","절경","계곡"]},
            {"name": "평창 오대천·방아다리약수", "location": "강원도 평창군", "desc": "평창 오대천변은 청정 계곡 캠핑의 성지입니다. 방아다리약수 인근 계곡 포인트는 여름철 피서객들의 발길이 끊이지 않습니다.", "tags": ["계곡","청정","여름피서","약수"]},
            {"name": "홍천 내린천", "location": "강원도 홍천군", "desc": "내린천은 수도권에서 가장 가깝고 물이 맑은 래프팅·캠핑 성지입니다. 강변 모래사장에서 텐트를 치고 별이 쏟아지는 밤하늘을 감상할 수 있습니다.", "tags": ["내린천","래프팅","모래사장","계곡"]},
            {"name": "인제 점봉산·한계령", "location": "강원도 인제군", "desc": "설악산 인근 점봉산과 한계령 일대는 강원도 비경 중 비경입니다. 내린천과 북천변 캠핑 포인트에서 울창한 원시림을 느낄 수 있습니다.", "tags": ["원시림","설악산","계곡","비경"]},
            {"name": "화천 파로호·산소길", "location": "강원도 화천군", "desc": "파로호 호반과 화천 산소길 주변은 청정자연 속 한적한 캠핑을 즐길 수 있는 강원도 북부의 숨은 명소입니다. 산천어축제로도 유명합니다.", "tags": ["파로호","청정","한적","겨울"]},
            {"name": "고성 화진포·송지호", "location": "강원도 고성군", "desc": "화진포 호수와 동해바다가 만나는 고성은 강원도 최북단 캠핑 성지입니다. 화진포성(이승만 별장), 송지호 조류관찰대 등 볼거리도 풍부합니다.", "tags": ["화진포","석호","바다","최북단"]},
            {"name": "양구 파로호·두타연", "location": "강원도 양구군", "desc": "민통선 DMZ 인근 두타연 계곡은 접근이 까다롭지만 그만큼 원시적인 자연을 자랑합니다. 파로호 선착장 인근 캠핑도 인기입니다.", "tags": ["DMZ","두타연","계곡","원시자연"]},
            {"name": "철원 한탄강 협곡", "location": "강원도 철원군", "desc": "철원 한탄강 주상절리 협곡은 강원도에서만 볼 수 있는 독특한 지질 경관입니다. 직탕폭포와 순담계곡 인근 캠핑이 백미입니다.", "tags": ["주상절리","협곡","한탄강","지질"]},
        ],
        "tips": ["강원도 해변 차박은 성수기(7~8월) 유료화되는 곳이 많으니 미리 확인하세요", "동해안 해변은 일출 시간이 이르므로 침낭 외 방한 겨구를 챙기세요", "강원도 계곡 캠핑은 갑작스런 폭우에 대비한 기상 확인이 필수입니다", "DMZ 인근(화천, 양구, 철원, 고성) 일부 구역은 출입 허가가 필요할 수 있습니다"],
        "related": [("sokcho","속초"), ("gangneung","강릉"), ("yangyang","양양"), ("samcheok","삼척"), ("jeongseon","정선"), ("pyeongchang","평창"), ("hongcheon","홍천"), ("hwacheon","화천"), ("cheorwon","철원"), ("yanggu","양구")],
    },
    {
        "slug": "jeonnam-best",
        "title": "전라남도 노지캠핑 명소 BEST 10 | 섬·갯벌·다도해 차박 성지 2025",
        "description": "전라남도 노지캠핑 BEST 10! 완도 청산도, 여수 향일암, 고흥 거금도, 해남 땅끝마을, 신안 다도해까지. 남도의 아름다운 섬과 바다를 배경으로 하는 최고의 캠핑 명소를 소개합니다.",
        "keywords": "전라남도 노지캠핑,전남 차박,여수 노지캠핑,완도 캠핑,고흥 차박,해남 노지캠핑,신안 캠핑,다도해 차박,남도 캠핑 성지",
        "geo": "KR-46",
        "intro": "다도해의 보석 같은 섬들과 갯벌, 한려해상국립공원까지 — 전라남도는 자연의 다양성이 넘치는 캠핑 천국입니다. 남도 10대 명소를 소개합니다.",
        "spots": [
            {"name": "여수 돌산도·향일암", "location": "전라남도 여수시", "desc": "여수 돌산도는 밤바다 야경과 함께하는 차박의 성지입니다. 향일암 일출은 한국 4대 일출 중 하나로 꼽히며, 은적암 인근 바다뷰 포인트에서의 캠핑이 일품입니다.", "tags": ["야경","일출","바다뷰","차박"]},
            {"name": "고흥 나로도·거금도", "location": "전라남도 고흥군", "desc": "우주발사전망대로 유명한 고흥. 나로도해수욕장과 거금도 일주도로 해변 포인트는 전남 최고의 차박 성지로 손꼽힙니다. 해수욕과 낚시를 함께 즐길 수 있습니다.", "tags": ["섬캠핑","바다","낚시","비경"]},
            {"name": "완도 청산도·보길도", "location": "전라남도 완도군", "desc": "슬로시티 청산도와 윤선도 문학의 섬 보길도는 전남 섬 캠핑의 정수입니다. 청산도 범바위 해변과 보길도 세연정 인근 캠핑이 특히 아름답습니다.", "tags": ["슬로시티","섬","바다","청정"]},
            {"name": "해남 땅끝마을·달마산", "location": "전라남도 해남군", "desc": "한반도 최남단 땅끝마을에서 시작하는 달마고도 트레킹과 캠핑은 특별한 경험입니다. 땅끝전망대에서 바라보는 다도해 일몰은 잊을 수 없는 절경입니다.", "tags": ["최남단","땅끝","다도해","일몰"]},
            {"name": "신안 증도·압해도", "location": "전라남도 신안군", "desc": "유네스코 생물권보전지역 신안 증도는 갯벌과 소금밭이 어우러진 독특한 캠핑지입니다. 우전해수욕장 주변 차박이 특히 인기입니다.", "tags": ["갯벌","염전","유네스코","섬"]},
            {"name": "담양 메타세쿼이아길·죽녹원", "location": "전라남도 담양군", "desc": "메타세쿼이아 가로수길과 죽녹원으로 유명한 담양. 영산강 자전거길 인근 강변 포인트에서 자연과 함께하는 캠핑을 즐길 수 있습니다.", "tags": ["메타세쿼이아","대나무","강변","힐링"]},
            {"name": "순천만 갈대밭·동천", "location": "전라남도 순천시", "desc": "순천만 국가정원과 갈대밭을 품은 순천. 동천변 캠핑지에서 일몰에 물드는 갈대밭 풍경은 전국에서도 손에 꼽히는 절경입니다.", "tags": ["순천만","갈대","일몰","습지"]},
            {"name": "보성 녹차밭·율포해수욕장", "location": "전라남도 보성군", "desc": "초록빛 녹차밭과 청정 바다가 어우러진 보성. 율포해수욕장 인근 차박과 녹차밭 뷰 캠핑이 전국 캠퍼들 사이에서 인기입니다.", "tags": ["녹차","바다","힐링","힐링"]},
            {"name": "진도 울돌목·세방낙조", "location": "전라남도 진도군", "desc": "명량대첩의 역사가 살아있는 울돌목과 한국 3대 낙조 명소 세방낙조전망대 인근은 전남 최고의 일몰 차박지입니다.", "tags": ["일몰","낙조","역사","바다뷰"]},
            {"name": "장흥 천관산·득량만", "location": "전라남도 장흥군", "desc": "억새 산행으로 유명한 천관산과 득량만 바다가 어우러진 장흥. 수문해수욕장과 정남진전망대 인근 강변·해변 캠핑이 가능합니다.", "tags": ["억새","바다","한적","청정"]},
        ],
        "tips": ["전남 섬 캠핑은 페리 운항 시간과 기상 조건을 반드시 미리 확인하세요", "갯벌 지역 캠핑 시 조수 시간표를 숙지하고 안전한 위치에 텐트를 치세요", "남도 봄(유채꽃·벚꽃)과 가을(억새)이 캠핑 최적 시즌입니다", "섬 지역은 식수와 연료 조달이 어렵거나 비쌀 수 있으니 충분히 준비하세요"],
        "related": [("yeosu","여수"), ("goheung","고흥"), ("wando","완도"), ("haenam","해남"), ("damyang","담양"), ("suncheon","순천"), ("boseong","보성"), ("jindo","진도"), ("jangheung","장흥"), ("sinan","신안")],
    },
    # ── 테마별 ──────────────────────────────────────────────────
    {
        "slug": "free-camping-top20",
        "title": "전국 무료 노지캠핑 성지 TOP 20 | 공짜 차박 명소 완전정복 2025",
        "description": "돈 한 푼 안 드는 전국 무료 노지캠핑 성지 20곳! 강변, 해변, 산속 무료 차박지를 지역별로 총정리했습니다. 2025년 최신 정보로 업데이트된 무료 캠핑장 가이드.",
        "keywords": "무료 노지캠핑,무료 차박,공짜 캠핑,무료 캠핑장 추천,전국 무료 차박지,노지캠핑 성지,차박 무료,무료 노지캠핑 추천",
        "geo": "KR",
        "intro": "비용 걱정 없이 자연을 즐기는 무료 노지캠핑! 강변, 해변, 저수지, 산속 등 전국 최고의 무료 차박 성지 20곳을 엄선했습니다.",
        "spots": [
            {"name": "김포 전류리포구", "location": "경기도 김포시", "desc": "한강 하구의 아름다운 일출·일몰 명소. 완전 무료로 이용 가능한 수도권 대표 차박지입니다. 화장실 완비.", "tags": ["무료","한강","수도권","차박"]},
            {"name": "태안 안면도 방포해변", "location": "충청남도 태안군", "desc": "태안해안국립공원의 숨은 해변. 성수기 외 무료로 이용 가능한 서해안 최고 차박지 중 하나입니다.", "tags": ["무료","해변","서해","서해"]},
            {"name": "강릉 남항진 해변", "location": "강원도 강릉시", "desc": "강릉 안목해변 남쪽 한적한 해변. 비성수기 무료 차박이 가능한 동해안 최고의 일출 명소입니다.", "tags": ["무료","동해","일출","차박"]},
            {"name": "담양 메타세쿼이아 영산강변", "location": "전라남도 담양군", "desc": "영산강 자전거길 인근 강변 포인트. 무료로 이용 가능하며 메타세쿼이아 숲속 힐링 캠핑이 가능합니다.", "tags": ["무료","강변","숲속","힐링"]},
            {"name": "여주 남한강 백사장", "location": "경기도 여주시", "desc": "남한강 모래사장 차박지. 세종대왕 유적지 인근 무료 강변 차박 포인트가 여럿 있습니다.", "tags": ["무료","강변","모래사장"]},
            {"name": "정선 동강 어라연", "location": "강원도 정선군", "desc": "동강 래프팅 성지 어라연 인근. 무료 강변 캠핑이 가능하며 절벽과 맑은 강이 절경입니다.", "tags": ["무료","동강","래프팅","절경"]},
            {"name": "화천 파로호 호반", "location": "강원도 화천군", "desc": "파로호 호변 무료 차박지. 조용하고 아름다운 호수 뷰를 무료로 즐길 수 있는 강원 북부 명소입니다.", "tags": ["무료","호수","한적","청정"]},
            {"name": "고흥 거금도 해변", "location": "전라남도 고흥군", "desc": "나로도 우주센터 근처 거금도. 거금대교로 연결된 섬 해변에서 무료 차박이 가능합니다.", "tags": ["무료","섬","바다","낚시"]},
            {"name": "부안 변산반도 채석강", "location": "전라북도 부안군", "desc": "한국의 그랜드캐니언 채석강 인근. 적벽강·변산해수욕장 주변 무료 차박지로 유명합니다.", "tags": ["무료","절벽","해변","일몰"]},
            {"name": "해남 땅끝마을", "location": "전라남도 해남군", "desc": "한반도 최남단. 땅끝전망대 인근 주차장 차박이 가능하며 다도해 일몰이 압권입니다.", "tags": ["무료","최남단","다도해","일몰"]},
            {"name": "울진 왕피천", "location": "경상북도 울진군", "desc": "에코투어리즘의 성지 왕피천 생태계보전지역 인근 계곡. 청정 계곡 무료 캠핑으로 유명합니다.", "tags": ["무료","계곡","청정","생태"]},
            {"name": "봉화 낙동강 발원지", "location": "경상북도 봉화군", "desc": "낙동강 발원지 황지연못과 석포면 일대 강변 무료 차박지. 청정 원시자연 속 캠핑이 가능합니다.", "tags": ["무료","발원지","청정","오지"]},
            {"name": "청양 칠갑산 아래", "location": "충청남도 청양군", "desc": "충남의 알프스 칠갑산 자락 무료 계곡 캠핑지. 지천계곡과 장곡사 인근 포인트가 인기입니다.", "tags": ["무료","계곡","산","청정"]},
            {"name": "홍천 내린천 모래사장", "location": "강원도 홍천군", "desc": "내린천 래프팅 종점 인근 모래사장 무료 차박지. 수도권 근교 최고의 계곡 무료 캠핑 명소입니다.", "tags": ["무료","래프팅","모래사장","수도권근교"]},
            {"name": "가평 청평호반", "location": "경기도 가평군", "desc": "청평호 호반 무료 차박 포인트. 가평읍 인근 북한강변에 여러 무료 차박지가 있습니다.", "tags": ["무료","호수","북한강","근교"]},
            {"name": "삼척 장호항", "location": "강원도 삼척시", "desc": "에메랄드빛 바다로 유명한 장호항. 비수기에는 무료 차박이 가능한 동해안 인스타 핫플입니다.", "tags": ["무료","에메랄드","해변","인스타"]},
            {"name": "하동 섬진강변", "location": "경상남도 하동군", "desc": "봄 벚꽃으로 유명한 하동 섬진강변. 재첩과 함께 강변 무료 차박이 가능한 남부 최고 명소입니다.", "tags": ["무료","섬진강","벚꽃","봄"]},
            {"name": "남해 상주은모래비치", "location": "경상남도 남해군", "desc": "은빛 모래가 아름다운 상주은모래비치 인근. 남해 독일마을과 함께 방문할 수 있는 무료 차박 포인트입니다.", "tags": ["무료","은모래","남해","힐링"]},
            {"name": "진도 세방낙조", "location": "전라남도 진도군", "desc": "한국 3대 낙조 명소 세방전망대 인근 무료 차박. 다도해로 지는 황금빛 일몰이 압권입니다.", "tags": ["무료","낙조","다도해","일몰"]},
            {"name": "제주 함덕·김녕 해변", "location": "제주특별자치도", "desc": "제주 동쪽 에메랄드빛 함덕·김녕 해변 인근 차박 포인트. 일부 구역 무료 이용 가능.", "tags": ["무료","제주","에메랄드","해변"]},
        ],
        "tips": ["무료 캠핑지라도 쓰레기는 반드시 되가져가세요 — 무분별한 쓰레기 투기로 명소가 폐쇄되는 사례가 많습니다", "일부 강변·해변은 야영 금지 구역이 별도 지정되어 있으니 현장 안내판을 확인하세요", "성수기(7~8월)에는 무료이던 곳도 유료로 전환되는 경우가 있습니다", "화로대·불멍은 화재 위험이 있는 건조한 봄·가을에 특히 조심해야 합니다"],
        "related": [("gimpo","김포"), ("taean","태안"), ("gangneung","강릉"), ("damyang","담양"), ("buan","부안"), ("hadong","하동"), ("namhae","남해"), ("jindo","진도"), ("jeju","제주")],
    },
    {
        "slug": "chapark-beach-top",
        "title": "전국 바다뷰 차박 성지 TOP 15 | 해변 노지캠핑 최고 명소 2025",
        "description": "파도 소리 들으며 잠드는 바다뷰 차박! 동해·서해·남해 해변 차박 성지 15곳을 소개합니다. 에메랄드빛 동해부터 황금 낙조 서해까지 대한민국 최고의 해변 노지캠핑 명소.",
        "keywords": "바다뷰 차박,해변 노지캠핑,동해 차박,서해 차박,남해 차박,해변 캠핑 추천,바다 차박 성지,해변 차박 명소",
        "geo": "KR",
        "intro": "파도 소리를 자장가 삼아 잠드는 특별한 하룻밤 — 동해·서해·남해 최고의 바다뷰 차박 명소 15곳을 엄선했습니다.",
        "spots": [
            {"name": "삼척 장호항·초곡항", "location": "강원도 삼척시", "desc": "한국의 나폴리. 에메랄드빛 바다와 기암절벽이 어우러진 동해 최고의 차박 성지입니다. 스노클링과 해상케이블카를 함께 즐길 수 있습니다.", "tags": ["동해","에메랄드","스노클링","인스타"]},
            {"name": "강릉 남항진해변", "location": "강원도 강릉시", "desc": "커피거리 안목해변과 인접한 한적한 해변 차박지. 일출이 아름답고 강릉 중심부 접근이 쉽습니다.", "tags": ["동해","일출","차박","접근성"]},
            {"name": "양양 하조대·남애항", "location": "강원도 양양군", "desc": "서핑 성지 양양의 하조대 등대와 남애항은 일출과 파도를 즐기며 차박하기 최고의 장소입니다.", "tags": ["동해","서핑","일출","하조대"]},
            {"name": "속초 외옹치·영금정", "location": "강원도 속초시", "desc": "설악산을 배경으로 동해를 마주하는 속초. 외옹치 바다향기길과 영금정 인근 해변 차박이 인기입니다.", "tags": ["동해","설악산뷰","바다향기길"]},
            {"name": "고성 화진포·봉포해변", "location": "강원도 고성군", "desc": "한국 최북단 동해안 화진포. 석호 화진포와 동해바다가 만나는 환상적인 경관 속 차박 명소입니다.", "tags": ["동해","석호","최북단","차박"]},
            {"name": "태안 몽산포·방포해변", "location": "충청남도 태안군", "desc": "서해안 대표 차박 성지 태안. 몽산포와 방포해변은 서해 낙조와 모래사장이 어우러진 최고의 서해 차박지입니다.", "tags": ["서해","낙조","모래사장","차박"]},
            {"name": "보령 대천해수욕장·머드", "location": "충청남도 보령시", "desc": "머드 축제로 유명한 대천. 보령 해수욕장 인근에서 서해 낙조를 감상하며 차박을 즐길 수 있습니다.", "tags": ["서해","낙조","머드","여름"]},
            {"name": "부안 변산반도 해변", "location": "전라북도 부안군", "desc": "채석강·적벽강의 기암절벽과 서해 낙조가 어우러진 변산반도. 한국에서 가장 아름다운 서해 차박지 중 하나입니다.", "tags": ["서해","절벽","낙조","비경"]},
            {"name": "여수 돌산도·금오도", "location": "전라남도 여수시", "desc": "여수 밤바다 야경과 금오도의 비렁길. 돌산도 해변 차박은 남해 최고의 야경과 함께하는 낭만적인 경험입니다.", "tags": ["남해","야경","낭만","차박"]},
            {"name": "고흥 나로도·거금도", "location": "전라남도 고흥군", "desc": "나로우주센터와 함께 방문할 수 있는 나로도. 거금도 일주해안도로의 비경 속 차박이 남해 최고의 드라이브 코스입니다.", "tags": ["남해","섬","낚시","비경"]},
            {"name": "남해 상주은모래·미조항", "location": "경상남도 남해군", "desc": "은빛 모래와 에메랄드빛 바다가 조화를 이루는 상주은모래비치. 남해 독일마을과 함께 방문하는 남해 최고의 차박지입니다.", "tags": ["남해","은모래","에메랄드","힐링"]},
            {"name": "거제 학동·홍포해변", "location": "경상남도 거제시", "desc": "몽돌해변으로 유명한 학동해수욕장. 파도에 굴러다니는 몽돌 소리를 들으며 차박하는 거제 최고의 해변 차박 명소입니다.", "tags": ["남해","몽돌","거제","차박"]},
            {"name": "진도 세방·관매도", "location": "전라남도 진도군", "desc": "한국 3대 낙조 세방전망대와 국립공원 관매도. 다도해 석양을 배경으로 하는 최고의 서남해 차박지입니다.", "tags": ["낙조","다도해","서남해","비경"]},
            {"name": "완도 보길도·청산도", "location": "전라남도 완도군", "desc": "고산 윤선도가 사랑한 보길도와 슬로시티 청산도. 남해 다도해 최고의 섬 차박지로 방문 예약 추천 명소입니다.", "tags": ["섬","다도해","슬로시티","비경"]},
            {"name": "제주 함덕·협재 해변", "location": "제주특별자치도", "desc": "에메랄드빛 제주 해변. 함덕 서우봉 해변과 협재·금능 해변은 제주 차박의 필수 코스입니다.", "tags": ["제주","에메랄드","협재","차박"]},
        ],
        "tips": ["해변 차박 시 조수 간만의 차를 고려해 안전한 위치를 선택하세요", "성수기 해변 차박지는 유료화 또는 금지 구역이 생기므로 사전 확인 필수", "바닷바람이 강한 날은 텐트 고정에 특히 신경 쓰고 스텍을 충분히 박으세요", "쓰레기 zero 캠핑 — 해변 차박지를 다음 사람도 즐길 수 있도록 깨끗이 사용해주세요"],
        "related": [("samcheok","삼척"), ("gangneung","강릉"), ("yangyang","양양"), ("taean","태안"), ("boryeong","보령"), ("yeosu","여수"), ("goheung","고흥"), ("namhae","남해"), ("geoje","거제"), ("jeju","제주")],
    },
    {
        "slug": "daebudo-camping",
        "title": "대부도 노지캠핑·차박 완전 가이드 2025 | 시화호·선재도·탄도항",
        "description": "수도권 최고의 섬 차박지 대부도! 시화호 갯벌, 선재도 목섬, 탄도항 바람개비 언덕, 방아머리 해변까지 대부도 노지캠핑 핫플 8곳을 총정리했습니다.",
        "keywords": "대부도 노지캠핑,대부도 차박,대부도 캠핑,시화호 차박,선재도 캠핑,탄도항 차박,방아머리 해변,안산 대부도 캠핑",
        "geo": "KR-41",
        "intro": "서울·수도권에서 1시간! 시화방조제를 건너면 만나는 대부도는 갯벌과 바다, 석양이 어우러진 수도권 최고의 섬 노지캠핑 성지입니다.",
        "spots": [
            {"name": "탄도항 바람개비 언덕", "location": "경기도 안산시 대부동", "desc": "대부도 최고의 포토스팟 탄도항. 갯벌 위로 물이 빠지면 드러나는 탄도섬을 배경으로 한 일몰은 수도권 최고의 낙조 중 하나입니다. 주변 차박 포인트에서 노을을 감상하세요.", "tags": ["일몰","갯벌","포토스팟","수도권"]},
            {"name": "선재도 목섬", "location": "경기도 안산시 선재도", "desc": "썰물 때만 연결되는 신비의 섬 목섬. 대부도에서 선재대교를 건너면 나오는 선재도에서 도보로 접근 가능한 섬 차박 명소입니다.", "tags": ["목섬","갯벌","썰물","신비"]},
            {"name": "방아머리 해변", "location": "경기도 안산시 대부북동", "desc": "대부도 북쪽 방아머리 해변은 조개잡이와 갯벌 체험이 가능한 서해 차박 명소입니다. 일몰 명소로도 유명합니다.", "tags": ["갯벌체험","일몰","조개","차박"]},
            {"name": "시화방조제 노을길", "location": "경기도 시흥·안산", "desc": "시화방조제 위 노을길 자전거도로와 해양에너지홍보관 인근은 시화호를 배경으로 한 특별한 차박 포인트입니다.", "tags": ["시화호","노을","자전거","풍력"]},
            {"name": "대부도 포도밭 길 캠핑", "location": "경기도 안산시 대부도", "desc": "대부도 특산물 포도밭 사이를 달리는 드라이브 코스와 함께 즐기는 힐링 캠핑. 가을 포도 수확철 방문이 특히 좋습니다.", "tags": ["포도","힐링","드라이브","가을"]},
            {"name": "구봉도 낙조전망대", "location": "경기도 안산시 대부동", "desc": "대부도 끝자락 구봉도는 서해 낙조 명소로 유명합니다. 낙조전망대까지 트레킹 후 인근 차박지에서 하룻밤을 보내세요.", "tags": ["낙조","트레킹","서해","일몰"]},
            {"name": "대부해솔길 캠핑", "location": "경기도 안산시 대부도", "desc": "대부도 해안 둘레길 해솔길 인근 해변 포인트. 갯벌과 소나무 숲이 어우러진 대부도만의 독특한 캠핑 경험을 즐길 수 있습니다.", "tags": ["둘레길","소나무","갯벌","힐링"]},
            {"name": "누에섬 등대 전망대", "location": "경기도 안산시 탄도", "desc": "탄도 방파제에서 걸어갈 수 있는 누에섬은 물때에 따라 접근이 달라지는 신비로운 섬입니다. 등대와 함께 서해 파노라마를 감상하세요.", "tags": ["등대","서해","신비","물때"]},
        ],
        "tips": ["대부도는 수도권에서 매우 가깝지만 주말 오전엔 시화방조제가 막히니 이른 출발을 추천합니다", "선재도·목섬은 물때(조수 시간)를 반드시 확인하고 방문하세요 — 고립될 수 있습니다", "갯벌 차박지는 밀물 시 침수될 수 있으니 안전한 고지대에 주차하세요", "대부도 내 낚시터와 캠핑장을 결합한 유료 시설도 많으니 선택지로 고려하세요"],
        "related": [("ansan","안산"), ("siheung","시흥"), ("incheon","인천"), ("gimpo","김포"), ("hwaseong","화성"), ("pyeongtaek","평택"), ("taean","태안"), ("boryeong","보령")],
    },
    {
        "slug": "gyeongnam-best",
        "title": "경상남도 노지캠핑 명소 BEST 10 | 남해·한려해상 차박 성지 2025",
        "description": "경상남도 노지캠핑 BEST 10! 남해 독일마을, 거제 학동, 통영 한려수도, 하동 섬진강, 밀양 얼음골까지. 경남 최고의 바다·강·산 노지캠핑 명소를 소개합니다.",
        "keywords": "경상남도 노지캠핑,경남 차박,남해 캠핑,거제 노지캠핑,통영 차박,하동 캠핑,밀양 캠핑,경남 캠핑 명소,한려해상 차박",
        "geo": "KR-48",
        "intro": "한려해상국립공원의 푸른 바다와 섬진강의 봄 벚꽃, 지리산 자락의 청정 계곡까지 — 경상남도는 사계절 캠핑이 가능한 다양한 명소를 품고 있습니다.",
        "spots": [
            {"name": "남해 상주은모래·독일마을", "location": "경상남도 남해군", "desc": "에메랄드빛 바다와 은빛 모래가 만나는 상주은모래비치. 독일마을과 함께 방문하는 남해 최고 차박 코스입니다.", "tags": ["남해","은모래","독일마을","에메랄드"]},
            {"name": "거제 학동·홍포·명사해수욕장", "location": "경상남도 거제시", "desc": "몽돌 소리가 아름다운 학동해수욕장과 홍포해변. 거제도 일주 드라이브와 함께 즐기는 남해 최고의 해변 차박입니다.", "tags": ["몽돌","남해","드라이브","거제"]},
            {"name": "통영 한려수도·비진도", "location": "경상남도 통영시", "desc": "한려해상국립공원의 심장 통영. 비진도와 연화도 등 섬 캠핑과 욕지도 등 다양한 섬 차박이 가능합니다.", "tags": ["한려수도","섬","국립공원","남해"]},
            {"name": "하동 섬진강·화개장터", "location": "경상남도 하동군", "desc": "봄 벚꽃으로 유명한 섬진강 화개장터. 강변 재첩국과 함께 즐기는 강변 차박은 하동 방문의 필수 코스입니다.", "tags": ["섬진강","벚꽃","재첩","봄"]},
            {"name": "밀양 얼음골·사자평", "location": "경상남도 밀양시", "desc": "여름에도 얼음이 어는 신비로운 얼음골과 고산습지 사자평. 영남알프스 산악 캠핑의 대표 명소입니다.", "tags": ["얼음골","영남알프스","산악","여름"]},
            {"name": "사천 실안해안도로", "location": "경상남도 사천시", "desc": "3.8km의 아름다운 해안도로를 따라 펼쳐진 실안 노을길. 한려해상 다도해 석양을 감상하며 차박하기 최고입니다.", "tags": ["해안도로","노을","다도해","드라이브"]},
            {"name": "고성 공룡나라·당항포", "location": "경상남도 고성군", "desc": "공룡 발자국 화석과 당항포 해전 역사가 살아있는 고성. 당항포관광지 인근 해변 차박과 오션뷰 캠핑이 가능합니다.", "tags": ["공룡","역사","해변","남해"]},
            {"name": "함양 지리산 자락", "location": "경상남도 함양군", "desc": "지리산 10경을 품은 함양. 용추계곡과 함양읍 상림공원 인근이 경남 최고의 계곡 캠핑지입니다.", "tags": ["지리산","계곡","청정","상림"]},
            {"name": "산청 지리산·황매산", "location": "경상남도 산청군", "desc": "지리산 대원사 계곡과 봄이면 철쭉이 만발하는 황매산. 경남 최고의 산악 노지캠핑 명소입니다.", "tags": ["지리산","황매산","철쭉","산악"]},
            {"name": "창녕 우포늪·화왕산", "location": "경상남도 창녕군", "desc": "국내 최대 자연늪 우포늪과 억새로 유명한 화왕산. 생태 캠핑의 성지이며 특별한 자연 속 하룻밤을 보낼 수 있습니다.", "tags": ["우포늪","억새","생태","화왕산"]},
        ],
        "tips": ["경남 섬 캠핑은 여객선 스케줄을 미리 확인하고 예약하세요", "한려해상 해변은 7~8월 성수기 차박 금지 구역이 많으니 사전 확인이 필수입니다", "지리산 인근 계곡 캠핑은 기상 변화에 유의하고 허가된 구역만 이용하세요", "섬진강변 봄 벚꽃 캠핑(3~4월)은 전국에서 캠퍼들이 몰리니 일찍 자리를 잡으세요"],
        "related": [("namhae","남해"), ("geoje","거제"), ("tongyeong","통영"), ("hadong","하동"), ("miryang","밀양"), ("sacheon","사천"), ("goseong","고성"), ("hamyang","함양"), ("sancheong","산청"), ("changnyeong","창녕")],
    },
]


def make_spot_html(spot):
    tags = "".join(f'<span class="tag">{t}</span>' for t in spot["tags"])
    return f"""
        <div class="spot-card">
            <h2>⛺ {spot['name']}</h2>
            <div class="location">📍 {spot['location']}</div>
            <p>{spot['desc']}</p>
            <div class="tags">{tags}</div>
        </div>"""


def make_page(p):
    out = html_head(p["title"], p["description"], p["keywords"], p["slug"], p.get("geo","KR"))
    out += f"""
    <header>
        <h1>{p['title']}</h1>
        <p>전국 노지캠핑·차박 가이드 | emfls.com</p>
    </header>
    <div class="intro"><p>{p['intro']}</p></div>
    <div class="spots-grid">{"".join(make_spot_html(s) for s in p['spots'])}</div>
    <div class="tips-box">
        <h3>⚠️ 노지캠핑 필수 체크리스트</h3>
        <ul>{"".join(f'<li>{t}</li>' for t in p['tips'])}</ul>
    </div>"""
    out += html_foot(p["related"])
    return out


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    generated = []
    for p in PAGES:
        path = OUTPUT_DIR / f"{p['slug']}.html"
        path.write_text(make_page(p), encoding="utf-8")
        generated.append(f"https://emfls.com/kor/report/camp/{p['slug']}.html")
        print(f"  ✓ {p['slug']}.html 생성")

    print(f"\n완료: {len(generated)}개 생성")

    new_urls_path = REPO_ROOT / "scripts/new_urls.txt"
    with open(new_urls_path, "a", encoding="utf-8") as f:
        f.write("\n".join(generated) + "\n")
    return generated


if __name__ == "__main__":
    main()
