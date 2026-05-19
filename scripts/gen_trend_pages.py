"""
트렌드 발굴 키워드 → HTML 페이지 자동 생성기
scripts/data/trend_topics.json 을 읽어 카테고리별 페이지 생성
"""
import json
from pathlib import Path
from datetime import datetime

REPO_ROOT = Path(__file__).parent.parent
DATA_PATH = REPO_ROOT / "scripts/data/trend_topics.json"
SITE_URL = "https://emfls.com"
GA_ID = "G-QP5Q67GE5B"
ADSENSE_ID = "ca-pub-8830524482034754"
DAILY_LIMIT = 15  # 하루 최대 생성 수


# ── 공통 head / foot ────────────────────────────────────────────────
def head(title, desc, kw, canonical, lang="ko", schema_type="Article"):
    today = datetime.now().strftime("%Y-%m-%d")
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="keywords" content="{kw}">
<meta name="robots" content="index,follow">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="article">
<meta property="og:url" content="{canonical}">
<link rel="canonical" href="{canonical}">
<script type="application/ld+json">
{{"@context":"https://schema.org","@type":"{schema_type}",
"headline":"{title}","description":"{desc}",
"author":{{"@type":"Organization","name":"emfls.com"}},
"publisher":{{"@type":"Organization","name":"emfls.com","url":"https://emfls.com"}},
"datePublished":"{today}","dateModified":"{today}","inLanguage":"{lang}"}}
</script>
<script async src="https://www.googletagmanager.com/gtag/js?id={GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','{GA_ID}');</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={ADSENSE_ID}" crossorigin="anonymous"></script>
"""


def foot(updated=None):
    d = updated or datetime.now().strftime("%Y-%m-%d")
    return f"""<footer style="text-align:center;padding:20px;color:#888;font-size:.8rem;margin-top:20px;">
<p>© 2025 emfls.com | 정보 제공용이며 투자·의료 조언이 아닙니다 | 최종 업데이트: {d}</p>
<p><a href="{SITE_URL}" style="color:#4a9eff;">홈으로</a></p>
</footer>"""


# ── 캠핑 테마 페이지 ────────────────────────────────────────────────
CAMP_THEME_DATA = {
    "글램핑": {
        "title": "글램핑 추천 TOP 10 | 지역별 최고 글램핑장 완전정복 2025",
        "desc": "전국 글램핑 추천 TOP 10! 경기, 강원, 충청, 전남, 경남 지역별 최고 글램핑 명소를 가격대·시설·분위기별로 정리했습니다. 2025년 최신 글램핑 가이드.",
        "intro": "텐트 없이도 캠핑의 모든 것을 누리는 글램핑. 풀옵션 시설에서 자연을 만끽하고 싶은 분들을 위해 전국 추천 글램핑장을 지역별로 정리했습니다.",
        "spots": [
            ("경기 가평 스타힐리조트 글램핑", "경기도 가평군", "북한강뷰 풀옵션 글램핑. 에어컨·히터 완비, 조식 제공 옵션. 수상레저와 함께 즐기는 패키지가 인기입니다.", ["가평","북한강뷰","풀옵션","조식"]),
            ("강원 평창 휘닉스파크 글램핑", "강원도 평창군", "동계올림픽 성지 평창의 고지대 글램핑. 여름에도 서늘한 기온과 별하늘이 일품입니다.", ["평창","고지대","별하늘","사계절"]),
            ("강원 홍천 비발디파크 글램핑", "강원도 홍천군", "워터파크와 연계된 가족형 글램핑. 아이들과 함께하는 여름 글램핑으로 전국 최고 인기입니다.", ["홍천","워터파크","가족","여름"]),
            ("충남 태안 팜카밀레", "충충청남도 태안군", "허브 농장과 서해 석양을 동시에 즐기는 특별한 글램핑. 라벤더밭과 허브 체험이 함께합니다.", ["태안","서해","허브","석양"]),
            ("경북 경주 감성글램핑", "경상북도 경주시", "신라 천년 고도에서 즐기는 감성 글램핑. 첨성대·불국사와 가까워 역사 여행과 캠핑을 동시에.", ["경주","역사","감성","신라"]),
            ("전남 순천 생태글램핑", "전라남도 순천시", "순천만 국가정원 인근 자연 친화형 글램핑. 갈대밭 일몰과 함께하는 남도 감성이 압도적입니다.", ["순천","순천만","생태","남도"]),
            ("강원 강릉 바다뷰글램핑", "강원도 강릉시", "동해바다 정면 오션뷰 글램핑. 커피거리와 경포해변이 코앞이며 일출 감상이 하이라이트입니다.", ["강릉","오션뷰","일출","동해"]),
            ("제주 중문 럭셔리글램핑", "제주특별자치도 서귀포시", "한라산과 남해가 한눈에 들어오는 제주 최고급 글램핑. 전용 바베큐와 스파 시설 완비.", ["제주","럭셔리","한라산","스파"]),
            ("경남 남해 독일마을글램핑", "경상남도 남해군", "에메랄드빛 남해바다와 독일마을 분위기가 어우러진 독특한 글램핑 경험.", ["남해","독일마을","에메랄드","특별한"]),
            ("경기 양평 산속글램핑", "경기도 양평군", "남한강이 내려다보이는 양평 산속 글램핑. 서울에서 1시간 거리의 수도권 최고 접근성.", ["양평","남한강뷰","수도권","접근성"]),
        ],
        "tips": [
            "성수기(7~8월, 추석 연휴) 글램핑은 2~3개월 전 예약이 필수입니다",
            "가격대는 1박 10~30만원대가 일반적이며, 평일은 주말 대비 30~50% 저렴합니다",
            "취사 가능 여부와 반려동물 동반 가능 여부를 사전에 반드시 확인하세요",
            "글램핑장마다 제공 물품이 다르므로 침구·세면용품 제공 여부를 체크하세요",
        ],
        "output_dir": "kor/report/camp",
        "related_slugs": [("gyeonggi-best","경기도 캠핑"), ("gangwon-best","강원도 캠핑"), ("jeju-camping-best","제주 캠핑"), ("chapark-beach-top","바다뷰 차박")],
    },
    "오토캠핑": {
        "title": "오토캠핑 추천 BEST 10 | 차량 옆에서 즐기는 전국 명소 2025",
        "desc": "오토캠핑 추천 BEST 10! 수도권·강원·충청·남부 지역 최고의 오토캠핑장을 시설·가격·주변 관광지 기준으로 선별했습니다. 2025 오토캠핑 완벽 가이드.",
        "intro": "차 한 대만 있으면 어디든 캠핑장이 되는 오토캠핑. 전기 연결, 샤워실, 개별 배수구까지 완비된 전국 추천 오토캠핑장 BEST 10을 소개합니다.",
        "spots": [
            ("가평 자라섬 오토캠핑장", "경기도 가평군", "북한강변 자라섬에 자리한 대형 오토캠핑장. 전기 연결 가능, 샤워 시설 완비. 재즈 페스티벌 시즌(10월) 방문 추천.", ["가평","자라섬","전기","대형"]),
            ("태안 만리포 오토캠핑장", "충청남도 태안군", "서해 만리포해수욕장 바로 옆 오토캠핑장. 넓은 사이트와 깨끗한 화장실·샤워실이 강점.", ["태안","만리포","서해","해수욕"]),
            ("양양 낙산해변 오토캠핑장", "강원도 양양군", "동해바다 바로 앞 오토캠핑장. 서핑 성지 인근이며 해변까지 도보 1분 거리의 최고 입지.", ["양양","낙산","동해","서핑"]),
            ("담양 메타세쿼이아 캠핑파크", "전라남도 담양군", "유명한 메타세쿼이아 가로수길 인근 오토캠핑장. 사이트가 넓고 녹음이 풍성한 여름 최고 캠핑지.", ["담양","메타세쿼이아","넓음","녹음"]),
            ("경주 보문호 오토캠핑장", "경상북도 경주시", "경주 역사 투어와 함께하는 보문호수 옆 오토캠핑장. 불국사, 석굴암이 30분 이내.", ["경주","보문호","역사","관광"]),
            ("남해 상주은모래비치 오토캠핑", "경상남도 남해군", "에메랄드 바다와 백사장이 앞마당인 남해 최고 오토캠핑장. 바비큐 시설과 취사 가능.", ["남해","상주","바다","백사장"]),
            ("평창 대관령 하늘목장 캠핑", "강원도 평창군", "해발 900m 대관령 고원의 오토캠핑. 여름에도 서늘하고 별하늘이 맑아 여름 캠퍼 최애 장소.", ["평창","대관령","고원","별하늘"]),
            ("제주 비자림 오토캠핑장", "제주특별자치도 제주시", "천년 비자나무 숲 인근 제주 대표 오토캠핑장. 사이트가 잘 정비되어 있고 화장실이 청결합니다.", ["제주","비자림","숲속","청결"]),
            ("무주 덕유산 오토캠핑장", "전라북도 무주군", "덕유산 국립공원 자락 구천동 계곡변 오토캠핑장. 여름 계곡 물놀이와 겨울 스키를 함께 즐길 수 있습니다.", ["무주","덕유산","계곡","사계절"]),
            ("포천 산정호수 오토캠핑장", "경기도 포천시", "수도권 최고 경치 산정호수 옆 오토캠핑장. 호수뷰 사이트가 특히 인기이며 주변 관광지도 풍부합니다.", ["포천","산정호수","호수뷰","수도권"]),
        ],
        "tips": [
            "오토캠핑장은 성수기 주말 최소 1~2개월 전 예약이 필요합니다",
            "캠핑카·카라반 전용 사이트와 텐트 사이트를 구분해 예약하세요",
            "전기 사이트는 요금이 20~50% 높지만 겨울 캠핑 시 필수입니다",
            "반려동물 동반 가능 여부, 불 사용 가능 여부를 사전 확인하세요",
        ],
        "output_dir": "kor/report/camp",
        "related_slugs": [("gyeonggi-best","경기도 캠핑"), ("gangwon-best","강원도 캠핑"), ("free-camping-top20","무료캠핑 TOP20"), ("valley-camping-top10","계곡 캠핑")],
    },
    "백패킹": {
        "title": "백패킹 코스 추천 TOP 10 | 초보~고수 전국 산행 완전정복 2025",
        "desc": "백패킹 코스 추천 TOP 10! 지리산 종주, 설악산 공룡능선, 한라산, 덕유산 등 전국 최고의 백패킹 루트를 난이도·소요일수·포인트별로 정리했습니다.",
        "intro": "배낭 하나에 텐트와 침낭을 싣고 떠나는 백패킹. 오지의 별하늘과 산중 고요함은 다른 어떤 캠핑과도 비교할 수 없습니다. 초보부터 고수까지 전국 추천 코스 TOP 10입니다.",
        "spots": [
            ("지리산 종주 (천왕봉~노고단)", "전남·전북·경남", "대한민국 최고 백패킹 코스. 총 25.5km, 2박 3일. 세석·장터목 대피소 예약 필수. 봄 철쭉, 가을 단풍이 절정입니다.", ["지리산","2박3일","종주","철쭉"]),
            ("설악산 공룡능선 종주", "강원도 속초·인제", "험난하지만 압도적인 경관의 설악산 공룡능선. 1박 2일 권장. 희운각 대피소 예약 필수. 가을 단풍 시즌이 최고입니다.", ["설악산","공룡능선","1박2일","단풍"]),
            ("한라산 성판악~관음사 종주", "제주특별자치도", "한라산 백록담을 넘는 제주 최고 백패킹. 숙박 불가능하므로 당일 완주 또는 1박은 대피소 예약 필요. 탐방 예약제 운영.", ["한라산","백록담","당일","예약제"]),
            ("덕유산 향적봉 종주", "전북·경남", "무주구천동~향적봉~육십령 2박 3일. 겨울 설경 백패킹 성지. 구천동 계곡과 고원 눈꽃이 압도적.", ["덕유산","겨울설경","2박3일","눈꽃"]),
            ("북한산 우이령 코스", "서울·경기", "수도권 백패킹의 정수. 우이령 허가 구간을 통과하는 1박 2일 코스. 서울에서 30분, 별하늘이 아름다운 북한산 비경.", ["북한산","수도권","1박2일","허가"]),
            ("오대산 선재길~노인봉", "강원도 평창·강릉", "월정사 전나무 숲에서 시작해 소금강까지 이어지는 오대산 종주 백패킹. 진고개 야영지 이용.", ["오대산","전나무","진고개","소금강"]),
            ("태백산 문수봉~장군봉", "강원도 태백", "해발 1,567m 태백산. 주목 군락지와 천제단 일출이 압도적. 당일 또는 1박 2일 코스.", ["태백산","주목","일출","천제단"]),
            ("소백산 비로봉 종주", "경북·충북", "철쭉 만발하는 봄과 설경의 겨울이 아름다운 소백산. 희방사~비로봉~죽령 1박 2일 종주.", ["소백산","철쭉","비로봉","봄"]),
            ("가야산 상아덤~칠불봉", "경남·경북", "해인사에서 시작하는 가야산 종주. 기암괴석 칠불봉과 상아덤의 절경. 당일 또는 1박.", ["가야산","해인사","칠불봉","기암"]),
            ("제주 한라산 영실~어리목", "제주특별자치도", "제주 초보 백패킹 입문 코스. 영실 병풍바위를 오르며 제주 전경을 감상하는 반나절 코스.", ["제주","영실","병풍바위","입문"]),
        ],
        "tips": [
            "국립공원 대피소·야영지는 예약 시스템(reservation.knps.or.kr)에서 사전 예약 필수",
            "10L당 0.9kg을 기준으로 배낭 무게를 체중의 25% 이내로 유지하세요",
            "여름 산행은 오전 6시 이전 출발, 번개 위험 오후 2~4시에는 능선 피하기",
            "비상식량, 구급약, 방수 재킷은 날씨와 무관하게 항상 챙기세요",
        ],
        "output_dir": "kor/report/camp",
        "related_slugs": [("gangwon-best","강원도 캠핑"), ("autumn-camping-top10","가을 단풍 캠핑"), ("valley-camping-top10","계곡 캠핑"), ("gyeongbuk-camping-best","경북 캠핑")],
    },
}

# ── 금융 가이드 페이지 ───────────────────────────────────────────────
FINANCE_DATA = {
    "ETF 추천": {
        "title": "ETF 추천 TOP 10 | 2025 초보 투자자를 위한 국내·해외 ETF 완전정복",
        "desc": "2025년 ETF 추천 TOP 10! S&P500, 나스닥100, 배당 ETF, 국내 코스피 ETF 등 초보자도 바로 투자 가능한 ETF를 수익률·비용·안정성 기준으로 정리했습니다.",
        "intro": "ETF(상장지수펀드)는 개별 주식보다 분산 투자가 쉽고, 펀드보다 비용이 낮아 장기 투자에 최적화된 금융상품입니다. 2025년 초보 투자자를 위한 ETF 추천 리스트를 소개합니다.",
        "items": [
            ("TIGER 미국S&P500", "국내 상장 해외ETF", "미국 S&P500 지수를 추종하는 국내 최인기 ETF. 미국 대형주 500개에 분산 투자. 환율 변동 노출.", "연간 보수: 0.07%", ["S&P500","미국주식","장기투자","분산"]),
            ("KODEX 나스닥100", "국내 상장 해외ETF", "애플·마이크로소프트·엔비디아 등 미국 기술주 100개 투자. 성장성 높지만 변동성도 큽니다.", "연간 보수: 0.05%", ["나스닥","기술주","성장","KODEX"]),
            ("TIGER 미국배당다우존스", "국내 상장 배당ETF", "미국 고배당 우량주에 투자하며 월 배당금을 받을 수 있는 ETF. 은퇴 준비 투자자에게 인기.", "연간 보수: 0.01%", ["배당","월배당","다우존스","은퇴"]),
            ("KODEX 200", "국내 ETF", "코스피 200 대형주에 투자하는 국내 대표 ETF. 삼성전자·SK하이닉스 등 국내 우량주 분산 투자.", "연간 보수: 0.15%", ["코스피","국내주식","대형주","안정"]),
            ("TIGER 차이나전기차SOLACTIVE", "해외 테마ETF", "BYD·NIO 등 중국 전기차 관련주에 투자. 고위험 고수익 테마 ETF. 변동성 매우 큽니다.", "연간 보수: 0.59%", ["중국","전기차","테마","고위험"]),
            ("KODEX 삼성그룹", "국내 섹터ETF", "삼성 계열사 전체에 분산 투자하는 ETF. 삼성전자 비중이 크며 한국 대표 기업군 투자.", "연간 보수: 0.27%", ["삼성","그룹주","국내","섹터"]),
            ("TIGER 미국테크TOP10INDXX", "국내 상장 해외ETF", "애플·마이크로소프트·엔비디아 등 미국 빅테크 10종목 집중 투자. 고성장 기술주 압축 투자.", "연간 보수: 0.49%", ["빅테크","AI","집중투자","고성장"]),
            ("KODEX 단기채권PLUS", "채권ETF", "초단기 국공채에 투자하는 안전 자산 ETF. 예금 대안으로 활용되며 원금 손실 위험이 낮습니다.", "연간 보수: 0.06%", ["채권","안전자산","예금대안","단기"]),
            ("TIGER 리츠부동산인프라", "국내 리츠ETF", "국내 상장 리츠(부동산투자신탁)에 분산 투자. 월 배당 지급. 부동산 간접 투자 수단.", "연간 보수: 0.29%", ["리츠","부동산","월배당","인프라"]),
            ("KODEX 인버스", "인버스ETF", "코스피200 지수 하락 시 수익을 내는 ETF. 단기 헤지 목적으로 사용. 장기 보유는 절대 비추.", "연간 보수: 0.64%", ["인버스","헤지","단기","하락장"]),
        ],
        "caution": "ETF 투자는 원금 손실 위험이 있습니다. 투자 전 본인의 투자 성향과 위험 수용도를 반드시 확인하세요. 이 정보는 투자 권유가 아닌 정보 제공 목적입니다.",
        "output_dir": "kor/report/finance",
        "related_urls": [("/kor/report/stock/us/index.html","미국 주식 분석"), ("/report/crypto/index.html","암호화폐 시세"), ("/kor/report/stock/us/spy.html","SPY ETF")],
    },
    "배당주 추천": {
        "title": "배당주 추천 TOP 10 | 2025 꾸준한 배당금 받는 국내·해외 배당주",
        "desc": "2025년 배당주 추천 TOP 10! 삼성전자, KT&G, 맥쿼리인프라 등 국내 고배당주와 코카콜라, 존슨앤존슨 등 해외 배당주를 배당수익률 기준으로 정리했습니다.",
        "intro": "배당주 투자는 주가 상승뿐 아니라 정기적인 배당금 수익까지 얻을 수 있는 투자 방식입니다. 꾸준히 배당을 지급해온 국내·해외 추천 배당주 TOP 10을 소개합니다.",
        "items": [
            ("삼성전자 (005930)", "국내 대형주", "한국 최대 반도체·가전 기업. 연 1.5~3% 수준 배당수익률. 특별 배당 지급 이력 있음. 코스피 시가총액 1위.", "배당수익률: 약 2~3%", ["삼성전자","반도체","대형주","코스피"]),
            ("KT&G (033780)", "국내 배당주", "국내 담배·홍삼 독과점 기업. 20년 이상 배당 지속. 안정적인 현금 흐름으로 배당 꾸준함. 연 4~5% 수준.", "배당수익률: 약 4~5%", ["KT&G","담배","홍삼","고배당"]),
            ("맥쿼리인프라 (088980)", "국내 인프라리츠", "도로·항만 등 인프라 자산에 투자하는 리츠. 연 6~7% 고배당. 월 배당 지급으로 현금 흐름 안정적.", "배당수익률: 약 6~7%", ["맥쿼리","인프라","월배당","고배당"]),
            ("SK텔레콤 (017670)", "국내 통신주", "국내 1위 통신사. 안정적 현금 흐름 바탕으로 연 3~5% 배당. 통신 인프라 투자 지속.", "배당수익률: 약 3~5%", ["SK텔레콤","통신","안정","배당"]),
            ("하나금융지주 (086790)", "국내 금융주", "하나은행 모회사. 금융지주사 중 배당성향 높은 편. 금리 상승기에 유리한 이자 이익 구조.", "배당수익률: 약 5~7%", ["하나금융","은행","금리","금융주"]),
            ("코카콜라 (KO)", "미국 배당왕", "62년 연속 배당 인상 배당왕. 글로벌 음료 독점 브랜드. 경기 침체에도 꾸준한 매출.", "배당수익률: 약 3%", ["코카콜라","배당왕","미국주식","소비재"]),
            ("존슨앤존슨 (JNJ)", "미국 배당왕", "61년 연속 배당 인상. 헬스케어 거대 기업. 경기 방어주 대표. 분기 배당 지급.", "배당수익률: 약 3%", ["JNJ","헬스케어","방어주","배당왕"]),
            ("프록터앤갬블 (PG)", "미국 배당왕", "팸퍼스·질레트 등 필수소비재 글로벌 1위. 67년 연속 배당 인상 배당왕 중의 왕.", "배당수익률: 약 2.5%", ["PG","소비재","배당왕","방어주"]),
            ("리얼티인컴 (O)", "미국 배당리츠", "월 배당 리츠의 대명사. 30년 이상 월 배당 지속. 부동산 임대 수익 기반 안정적 배당.", "배당수익률: 약 5~6%", ["리얼티인컴","월배당","리츠","부동산"]),
            ("AT&T (T)", "미국 통신주", "미국 최대 통신사. 배당수익률이 높은 편. 부채 축소 과정 중이나 꾸준한 배당 지속.", "배당수익률: 약 6~7%", ["AT&T","통신","고배당","미국"]),
        ],
        "caution": "배당주 투자 시 배당수익률만 보지 말고 기업의 재무 건전성, 배당성향, 부채 비율을 함께 확인하세요. 과거 배당이 미래 배당을 보장하지 않습니다.",
        "output_dir": "kor/report/finance",
        "related_urls": [("/kor/report/stock/us/ko.html","KO 코카콜라 분석"), ("/kor/report/stock/us/jnj.html","JNJ 분석"), ("/kor/report/stock/us/pg.html","PG 분석")],
    },
    "재테크 방법": {
        "title": "2025 재테크 방법 총정리 | 직장인 월급 200% 굴리기 완벽 가이드",
        "desc": "2025년 재테크 방법 완전정복! 예금·적금부터 주식·ETF·부동산·코인까지. 투자 초보자도 바로 시작할 수 있는 단계별 재테크 가이드를 총정리했습니다.",
        "intro": "월급을 그냥 예금에 넣어두는 시대는 끝났습니다. 2025년 현재 금리 환경에서 자산을 효과적으로 늘리는 재테크 방법 8가지를 난이도·기대수익률 순으로 정리합니다.",
        "items": [
            ("예금·적금 (난이도: ★☆☆)", "원금보장형", "가장 안전한 재테크. 2025년 시중은행 정기예금 연 3~4% 수준. 5천만 원까지 예금자 보호. 인터넷은행(카카오·토스·케이뱅크) 금리 비교 필수.", "기대수익: 연 3~4%", ["예금","적금","안전","원금보장"]),
            ("CMA 통장 (난이도: ★☆☆)", "단기 유동성", "증권사 CMA에 돈을 넣으면 매일 이자가 쌓이는 통장. 수시 입출금 가능하면서 예금보다 약간 높은 금리.", "기대수익: 연 3~4%", ["CMA","증권사","매일이자","유동성"]),
            ("국내 ETF 투자 (난이도: ★★☆)", "분산 투자", "코스피200·S&P500 등 지수 추종 ETF에 적립식 투자. 소액으로도 시작 가능하며 장기 복리 효과가 큽니다.", "기대수익: 연 5~10%(장기)", ["ETF","적립식","분산","장기"]),
            ("미국 주식 (난이도: ★★☆)", "해외 주식", "애플·마이크로소프트·엔비디아 등 글로벌 우량주 투자. 환율 위험이 있지만 장기 성장성이 높습니다.", "기대수익: 연 7~12%(역사적 평균)", ["미국주식","달러","해외","성장"]),
            ("부동산 투자 (난이도: ★★★)", "실물 자산", "아파트·상가·오피스텔 직접 투자. 목돈과 대출이 필요하며 유동성이 낮습니다. 리츠 ETF로 간접 투자도 가능.", "기대수익: 지역·시기에 따라 매우 다름", ["부동산","아파트","리츠","실물"]),
            ("채권·채권ETF (난이도: ★★☆)", "안정형", "국채·회사채 투자로 정기적 이자 수입. 주식보다 변동성 낮음. 금리 하락기에 채권 가격 상승 효과.", "기대수익: 연 3~5%", ["채권","국채","안정형","금리"]),
            ("암호화폐 (난이도: ★★★)", "고위험 고수익", "비트코인·이더리움 소액 분산 투자. 변동성이 매우 크므로 전체 자산의 5~10% 이내로 제한 권장.", "기대수익: 매우 높거나 큰 손실 가능", ["비트코인","이더리움","코인","고위험"]),
            ("ISA 계좌 활용 (난이도: ★★☆)", "절세 전략", "중개형 ISA 계좌로 ETF·주식 투자 시 이익 200만원까지 비과세. 세금 아끼는 재테크의 기본.", "절세 효과: 연간 최대 수십만원", ["ISA","절세","비과세","계좌"]),
        ],
        "caution": "모든 투자는 원금 손실 위험이 있습니다. 자신의 투자 성향과 재정 상황에 맞는 투자 전략을 선택하세요. 이 정보는 금융 상담을 대체하지 않습니다.",
        "output_dir": "kor/report/finance",
        "related_urls": [("/kor/report/stock/us/index.html","미국 주식 분석"), ("/report/crypto/index.html","암호화폐 시세"), ("/kor/report/stock/us/spy.html","SPY ETF 분석")],
    },
}

# ── 생활정보 허브 ────────────────────────────────────────────────────
LIFESTYLE_DATA = {
    "주말 여행지 추천": {
        "title": "2025 주말 여행지 추천 TOP 15 | 수도권·전국 당일·1박 코스",
        "desc": "주말 여행지 추천 TOP 15! 가평, 강릉, 여수, 제주, 경주 등 전국 최고의 주말 여행지를 소요 시간·예산·시즌별로 총정리했습니다. 2025 주말 여행 완벽 가이드.",
        "intro": "긴 여행은 못 가더라도 주말 하루 이틀로 일상 탈출이 가능한 전국 주말 여행지 TOP 15를 소개합니다. 서울 기준 거리순으로 정리했습니다.",
        "sections": [
            {
                "region": "🚗 수도권 근교 (2시간 이내)",
                "spots": [
                    ("경기 가평·춘천", "당일~1박", "아침고요수목원, 남이섬, 춘천 닭갈비. 가족 여행의 정석. 서울에서 1~1.5시간.", ["가평","남이섬","가족","수도권"]),
                    ("경기 양평·여주", "당일~1박", "두물머리 일출, 여주 도자기 쇼핑. 드라이브 코스 최고. 남한강변 힐링.", ["양평","두물머리","드라이브","힐링"]),
                    ("인천 강화도", "당일", "전등사, 마니산, 동막해변. 역사와 자연을 동시에. 서울에서 1시간.", ["강화도","역사","해변","당일"]),
                    ("경기 파주", "당일", "임진각, 헤이리 예술마을, 프리미엄 아울렛. 문화+쇼핑 코스.", ["파주","헤이리","아울렛","문화"]),
                ],
            },
            {
                "region": "🚌 3~4시간 거리 (1박 추천)",
                "spots": [
                    ("강원 강릉·속초", "1박 2일", "경포해변, 중앙시장, 설악산. 동해바다+설악산 콤보. 서울에서 2.5시간.", ["강릉","속초","동해","설악"]),
                    ("충남 태안·보령", "1박 2일", "꽃지해변 낙조, 머드축제, 천리포수목원. 서해안 드라이브.", ["태안","보령","서해","낙조"]),
                    ("충북 단양", "1박 2일", "도담삼봉, 단양팔경, 만천하스카이워크. 남한강 래프팅 가능.", ["단양","래프팅","기암","스카이워크"]),
                    ("전북 전주", "1박 2일", "전주 한옥마을, 비빔밥, 막걸리. 음식과 문화의 도시. 서울에서 3시간.", ["전주","한옥마을","비빔밥","문화"]),
                ],
            },
            {
                "region": "✈️ 4시간 이상 (1박 2일~2박 3일)",
                "spots": [
                    ("경남 여수", "1박 2일", "여수 밤바다, 돌산공원, 오동도. 낭만 야경 도시. KTX 2.5시간.", ["여수","야경","낭만","KTX"]),
                    ("경북 경주", "1박 2일", "불국사, 석굴암, 첨성대, 황리단길. 신라 역사 여행. KTX 2시간.", ["경주","역사","불국사","황리단길"]),
                    ("부산", "1박 2일", "해운대, 광안리, 감천문화마을. 한국 제2도시 필수 코스. KTX 2.5시간.", ["부산","해운대","감천","KTX"]),
                    ("경남 통영", "1박 2일", "한려해상 국립공원, 케이블카, 굴 요리. 한국의 나폴리.", ["통영","한려수도","굴","케이블카"]),
                    ("전남 순천·광양", "1박 2일", "순천만 갈대밭, 광양 매화마을. 봄(2~4월) 매화가 압도적.", ["순천","광양","갈대","매화"]),
                    ("제주", "2박 3일", "한라산, 성산일출봉, 협재해변. 국내 최고 여행지. 제주항공 이용.", ["제주","한라산","성산","비행기"]),
                    ("강원 평창·정선", "1박 2일", "대관령 하늘목장, 정선 동강, 별마로천문대. 감성 힐링 여행.", ["평창","정선","대관령","별"]),
                ],
            },
        ],
        "output_dir": "kor/report/travel",
        "related_urls": [("/kor/report/camp/gangwon-best.html","강원도 캠핑"), ("/kor/report/camp/jeju-camping-best.html","제주 캠핑"), ("/kor/report/camp/gyeonggi-best.html","경기도 캠핑")],
    },
}


# ── 페이지 빌더 ───────────────────────────────────────────────────────
COMMON_CSS = """
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Noto Sans KR',sans-serif;background:#f5f7fa;color:#333;line-height:1.7;}
.container{max-width:1100px;margin:0 auto;padding:20px;}
header{background:linear-gradient(135deg,#1a237e,#283593,#3949ab);color:white;border-radius:14px;padding:36px 28px;text-align:center;margin-bottom:24px;box-shadow:0 8px 30px rgba(26,35,126,.3);}
header h1{font-size:1.9rem;margin-bottom:10px;line-height:1.35;}
header p{opacity:.8;font-size:.95rem;}
.intro-box{background:white;border-radius:12px;padding:22px 26px;margin-bottom:22px;box-shadow:0 4px 15px rgba(0,0,0,.07);border-left:5px solid #3949ab;}
.intro-box p{color:#444;font-size:.97rem;}
.section-title{color:#1a237e;font-size:1.1rem;font-weight:700;margin:22px 0 12px;padding-bottom:6px;border-bottom:2px solid #e8eaf6;}
.items-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px;margin-bottom:22px;}
.item-card{background:white;border-radius:13px;padding:22px;box-shadow:0 5px 18px rgba(0,0,0,.08);border-top:4px solid #3949ab;}
.item-card h2{color:#1a237e;font-size:1.1rem;margin-bottom:5px;}
.item-card .sub{color:#5c6bc0;font-size:.82rem;font-weight:600;margin-bottom:8px;}
.item-card .yield{background:#e8eaf6;color:#283593;border-radius:6px;padding:3px 10px;font-size:.82rem;display:inline-block;margin-bottom:8px;}
.item-card p{font-size:.88rem;color:#555;}
.tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px;}
.tag{background:#e8f5e9;color:#2e7d32;border-radius:20px;padding:2px 10px;font-size:.77rem;}
.caution{background:#fff3e0;border-radius:12px;padding:18px 22px;margin-bottom:20px;border-left:5px solid #ff9800;}
.caution p{font-size:.88rem;color:#e65100;}
.related-links{background:white;border-radius:12px;padding:18px 22px;margin-bottom:20px;box-shadow:0 4px 12px rgba(0,0,0,.06);}
.related-links h3{color:#1a237e;font-size:.95rem;margin-bottom:10px;}
.links-row{display:flex;flex-wrap:wrap;gap:8px;}
.links-row a{background:#e8eaf6;color:#283593;border-radius:8px;padding:6px 14px;font-size:.84rem;text-decoration:none;font-weight:500;}
.links-row a:hover{background:#c5cae9;}
.breadcrumb{font-size:.8rem;color:#666;margin-bottom:12px;}
.breadcrumb a{color:#5c6bc0;text-decoration:none;}
@media(max-width:600px){header h1{font-size:1.4rem;}.items-grid{grid-template-columns:1fr;}}
</style>
"""


def build_camp_page(keyword, data):
    canonical = f"{SITE_URL}/{data['output_dir']}/{data.get('slug','')}.html"
    title = data["title"]
    desc = data["desc"]
    h = head(title, desc, keyword, canonical) + COMMON_CSS + "</head>\n<body>\n<div class='container'>\n"
    h += f'<div class="breadcrumb"><a href="{SITE_URL}">홈</a> &rsaquo; <a href="{SITE_URL}/kor/report/camp/index.html">노지캠핑</a> &rsaquo; {keyword}</div>\n'
    h += f'<header><h1>{title}</h1><p>emfls.com | 전국 노지캠핑·차박 가이드</p></header>\n'
    h += f'<div class="intro-box"><p>{data["intro"]}</p></div>\n'
    h += '<div class="items-grid">\n'
    for name, loc, desc_s, tags in data["spots"]:
        tag_html = "".join(f'<span class="tag">{t}</span>' for t in tags)
        h += f'''<div class="item-card">
<h2>⛺ {name}</h2>
<div class="sub">📍 {loc}</div>
<p>{desc_s}</p>
<div class="tags">{tag_html}</div>
</div>\n'''
    h += '</div>\n'
    # tips
    h += '<div class="caution"><h3 style="color:#e65100;margin-bottom:8px;">⚠️ 캠핑 필수 체크리스트</h3><ul style="padding-left:18px;">'
    for tip in data["tips"]:
        h += f'<li style="font-size:.9rem;color:#555;margin-bottom:6px;">{tip}</li>'
    h += '</ul></div>\n'
    # related
    h += '<div class="related-links"><h3>🗺️ 관련 캠핑 가이드</h3><div class="links-row">'
    for slug, name_r in data["related_slugs"]:
        h += f'<a href="{SITE_URL}/kor/report/camp/{slug}.html">{name_r}</a>'
    h += '</div></div>\n'
    h += foot()
    h += "</div></body></html>"
    return h


def build_finance_page(keyword, data):
    slug = data.get("slug", "")
    canonical = f"{SITE_URL}/{data['output_dir']}/{slug}.html"
    title = data["title"]
    desc = data["desc"]
    h = head(title, desc, keyword, canonical) + COMMON_CSS + "</head>\n<body>\n<div class='container'>\n"
    h += f'<div class="breadcrumb"><a href="{SITE_URL}">홈</a> &rsaquo; 금융·재테크 &rsaquo; {keyword}</div>\n'
    h += f'<header><h1>{title}</h1><p>emfls.com | 금융·재테크 정보 허브</p></header>\n'
    h += f'<div class="intro-box"><p>{data["intro"]}</p></div>\n'
    h += '<div class="items-grid">\n'
    for item in data["items"]:
        name, cat, desc_s, yield_s, tags = item
        tag_html = "".join(f'<span class="tag">{t}</span>' for t in tags)
        h += f'''<div class="item-card">
<h2>💰 {name}</h2>
<div class="sub">{cat}</div>
<span class="yield">{yield_s}</span>
<p>{desc_s}</p>
<div class="tags">{tag_html}</div>
</div>\n'''
    h += '</div>\n'
    h += f'<div class="caution"><p>⚠️ {data["caution"]}</p></div>\n'
    h += '<div class="related-links"><h3>📊 관련 투자 정보</h3><div class="links-row">'
    for url, label in data["related_urls"]:
        h += f'<a href="{SITE_URL}{url}">{label}</a>'
    h += '</div></div>\n'
    h += foot()
    h += "</div></body></html>"
    return h


def build_lifestyle_page(keyword, data):
    slug = data.get("slug", "")
    canonical = f"{SITE_URL}/{data['output_dir']}/{slug}.html"
    title = data["title"]
    desc = data["desc"]
    h = head(title, desc, keyword, canonical) + COMMON_CSS + "</head>\n<body>\n<div class='container'>\n"
    h += f'<div class="breadcrumb"><a href="{SITE_URL}">홈</a> &rsaquo; 여행·생활정보 &rsaquo; {keyword}</div>\n'
    h += f'<header><h1>{title}</h1><p>emfls.com | 생활정보 허브</p></header>\n'
    h += f'<div class="intro-box"><p>{data["intro"]}</p></div>\n'
    for section in data["sections"]:
        h += f'<div class="section-title">{section["region"]}</div>\n'
        h += '<div class="items-grid">\n'
        for name, duration, desc_s, tags in section["spots"]:
            tag_html = "".join(f'<span class="tag">{t}</span>' for t in tags)
            h += f'''<div class="item-card">
<h2>📍 {name}</h2>
<div class="sub">⏱️ 추천 일정: {duration}</div>
<p>{desc_s}</p>
<div class="tags">{tag_html}</div>
</div>\n'''
        h += '</div>\n'
    h += '<div class="related-links"><h3>🔗 관련 가이드</h3><div class="links-row">'
    for url, label in data["related_urls"]:
        h += f'<a href="{SITE_URL}{url}">{label}</a>'
    h += '</div></div>\n'
    h += foot()
    h += "</div></body></html>"
    return h


# ── 슬러그 → 데이터 매핑 ───────────────────────────────────────────────
import re, unicodedata

def slugify(text):
    text = text.lower().strip()
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"[^\w가-힣-]", "", text)
    return text[:50]


CAMP_SLUG_MAP = {
    "글램핑": "glamping-best",
    "오토캠핑": "autocamping-best",
    "백패킹": "backpacking-best",
}
FINANCE_SLUG_MAP = {
    "ETF 추천": "etf-recommendations-2025",
    "배당주 추천": "dividend-stocks-2025",
    "재테크 방법": "investment-guide-2025",
}
LIFESTYLE_SLUG_MAP = {
    "주말 여행지 추천": "weekend-travel-korea-2025",
}

PREDEFINED_PAGES = []

for kw, data in CAMP_THEME_DATA.items():
    slug = CAMP_SLUG_MAP.get(kw, slugify(kw))
    data["slug"] = slug
    PREDEFINED_PAGES.append({
        "slug": slug, "keyword": kw, "type": "camp_theme", "data": data,
        "output_dir": REPO_ROOT / data["output_dir"],
        "url": f"{SITE_URL}/{data['output_dir']}/{slug}.html",
    })

for kw, data in FINANCE_DATA.items():
    slug = FINANCE_SLUG_MAP.get(kw, slugify(kw))
    data["slug"] = slug
    PREDEFINED_PAGES.append({
        "slug": slug, "keyword": kw, "type": "finance_guide", "data": data,
        "output_dir": REPO_ROOT / data["output_dir"],
        "url": f"{SITE_URL}/{data['output_dir']}/{slug}.html",
    })

for kw, data in LIFESTYLE_DATA.items():
    slug = LIFESTYLE_SLUG_MAP.get(kw, slugify(kw))
    data["slug"] = slug
    PREDEFINED_PAGES.append({
        "slug": slug, "keyword": kw, "type": "lifestyle_hub", "data": data,
        "output_dir": REPO_ROOT / data["output_dir"],
        "url": f"{SITE_URL}/{data['output_dir']}/{slug}.html",
    })


def main():
    print("=" * 50)
    print("📄 트렌드 키워드 페이지 생성")
    print("=" * 50)

    generated = []
    skipped = 0

    for page in PREDEFINED_PAGES:
        if len(generated) >= DAILY_LIMIT:
            print(f"일일 한도({DAILY_LIMIT}개) 도달.")
            break

        out_dir = page["output_dir"]
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{page['slug']}.html"

        if out_path.exists():
            skipped += 1
            continue

        ptype = page["type"]
        kw = page["keyword"]
        data = page["data"]

        if ptype == "camp_theme":
            html = build_camp_page(kw, data)
        elif ptype == "finance_guide":
            html = build_finance_page(kw, data)
        elif ptype == "lifestyle_hub":
            html = build_lifestyle_page(kw, data)
        else:
            continue

        out_path.write_text(html, encoding="utf-8")
        generated.append(page["url"])
        print(f"  ✓ [{ptype}] {page['slug']}.html")

    print(f"\n완료: {len(generated)}개 생성, {skipped}개 이미 존재")

    if generated:
        new_urls_path = REPO_ROOT / "scripts/new_urls.txt"
        with open(new_urls_path, "a", encoding="utf-8") as f:
            f.write("\n".join(generated) + "\n")

    return generated


if __name__ == "__main__":
    main()
