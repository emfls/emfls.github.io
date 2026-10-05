"""Fail-closed, deterministic policy for selecting launch-ready keywords."""
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo
from difflib import SequenceMatcher
import re
from urllib.parse import urlsplit

SITE_HOST = "emfls.github.io"
SEOUL = ZoneInfo("Asia/Seoul")
DAILY_PUBLICATION_LIMIT = 3
FINAL_PUBLICATION_STATUSES = {"PUBLISHED", "LAUNCHED"}

# Query/content-type evidence is evaluated independently from the broad
# recovery taxonomy, whose subcategories (for example recovery:세금) are not
# reliable evidence about an individual query's intent.
_YMYL_TEXT_SIGNAL_GROUPS = (
    (
        "finance and tax",
        (
            "finance", "금융", "투자", "주식", "대출", "보험", "세금", "원천징수", "원천세",
            "갑근세", "소득세", "부가세", "종합소득세", "연말정산", "증여세", "양도세",
            "사업소득계산", "전자계산서", "계산서발행", "3.3",
        ),
    ),
    (
        "legal procedure",
        (
            "legal", "법률", "가압류", "가처분", "지급명령", "행정소송", "민사소송", "형사소송",
            "재산명시", "사실조회", "전자소송", "후견인", "법원", "소송", "압류", "채권추심",
            "저당권", "근저당", "이전등록", "피해구제신청", "자동차등록", "자동차구조변경",
            "자동차정기검사", "자동차종합검사", "자동차검사대행", "폐차서류", "폐차방법",
            "폐차하는법", "자동차매도서류", "비자신청", "워홀신청", "워킹홀리데이신청",
        ),
    ),
    (
        "debt and credit",
        ("불법사채", "사채", "채무조정", "개인회생", "개인파산", "파산신청", "회생신청", "신용회복", "채무", "채권", "못받은돈"),
    ),
    (
        "health, labor, and family leave",
        (
            "의료", "health", "medical", "육아휴직", "출산휴가", "배우자출산", "난임치료휴가",
            "가족돌봄휴가", "휴가신청서", "노무사상담", "노무사비용", "실업급여", "퇴직금", "퇴직소득", "급여", "임금", "주휴수당",
            "연장수당", "휴일수당", "법정수당", "근로계약", "근로기준", "산재",
            "연차계산", "연차수당", "연차휴가", "연차일수", "회계년도연차", "시급계산", "실수령액",
            "시간외수당", "월급", "연봉", "연장근로수당", "조기재취업수당", "수급자격신청",
            "알바비", "세후", "야간근로수당", "야간수당", "휴일근무수당", "노동청신고",
        ),
    ),
    (
        "regulated business filing",
        ("통신판매업신고",),
    ),
)
_NOISY_CATEGORY_PREFIXES = ("recovery:",)

def normalize_keyword(value):
    return re.sub(r"[^0-9a-z가-힣]", "", str(value or "").casefold())

_YMYL_NORMALIZED_HANGUL_SIGNALS = tuple(
    normalize_keyword(signal)
    for _, signals in _YMYL_TEXT_SIGNAL_GROUPS
    for signal in signals
    if re.search(r"[가-힣]", signal)
)

def normalize_url_identity(value):
    """Return the conservative same-site route identity used for deduplication."""
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = urlsplit(text)
        if parsed.scheme or parsed.netloc:
            if parsed.scheme.casefold() != "https" or (parsed.hostname or "").casefold() != SITE_HOST:
                return None
            if parsed.username is not None or parsed.password is not None:
                return None
            if parsed.port not in (None, 443):
                return None
        elif text.startswith("//"):
            return None
        path = parsed.path or "/"
    except ValueError:
        return None
    if not path.startswith("/"):
        return None
    if path.endswith("/index.html"):
        path = path[:-len("index.html")]
    return path

def keyword_from_candidate_id(candidate_id):
    """Parse only the explicit keyword namespace; unknown IDs are opaque."""
    text = str(candidate_id or "").strip()
    namespace, separator, value = text.partition(":")
    if not separator or namespace != "keyword":
        return None
    normalized = normalize_keyword(value)
    return normalized or None

def published_manifest_dedupe_keys(manifest):
    """Return URL and keyword identities only for final publication manifests."""
    if not isinstance(manifest, dict) or str(manifest.get("status") or "").upper() not in FINAL_PUBLICATION_STATUSES:
        return set(), set()
    url_values = manifest.get("urls")
    candidate_values = manifest.get("candidateIds")
    if not isinstance(url_values, (list, tuple)):
        url_values = []
    if not isinstance(candidate_values, (list, tuple)):
        candidate_values = []
    urls = {
        identity
        for value in url_values
        if (identity := normalize_url_identity(value)) is not None
    }
    keywords = {
        identity
        for value in candidate_values
        if (identity := keyword_from_candidate_id(value)) is not None
    }
    return urls, keywords

def publication_day(value):
    # Normalize publication timestamps to the site's KST calendar day.
    if not value:
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        text = str(value).strip()
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            try:
                return date.fromisoformat(text)
            except ValueError:
                return None
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(SEOUL)
    return parsed.date()


def publication_manifest_count(manifest, selected_day, daily_limit=DAILY_PUBLICATION_LIMIT):
    # Count final publications, or published counts carried by a tagged launch plan.
    if not isinstance(manifest, dict):
        return 0
    selected_day = publication_day(selected_day)
    if selected_day is None:
        return 0
    try:
        fail_closed_count = max(0, int(daily_limit))
    except (TypeError, ValueError):
        fail_closed_count = DAILY_PUBLICATION_LIMIT

    status = str(manifest.get("status") or "").upper()
    if status in FINAL_PUBLICATION_STATUSES:
        publication_date = publication_day(manifest.get("runAt"))
        if publication_date is None:
            return fail_closed_count
        if publication_date != selected_day:
            return 0
        count_values = True
    elif (
        status in {"READY", "NO_PUBLICATION"}
        and publication_day(manifest.get("publicationAccountingDate")) == selected_day
    ):
        count_values = False
    else:
        return 0

    counts = []
    published_today = manifest.get("publishedToday")
    if isinstance(published_today, int) and not isinstance(published_today, bool) and published_today >= 0:
        counts.append(published_today)
    elif isinstance(published_today, str) and published_today.strip().isdigit():
        counts.append(int(published_today.strip()))
    if count_values:
        for key in ("urls", "candidateIds", "contentPaths"):
            values = manifest.get(key)
            if isinstance(values, (list, tuple)):
                counts.append(sum(1 for value in values if isinstance(value, str) and value.strip()))
    return max(counts, default=0)


def _truthy(value): return str(value).casefold() in {"true", "1", "yes"}
def _tool(row):
    text = f"{row.get('category','')}|{row.get('content_types','')}|{row.get('intent','')}".casefold()
    return any(x in text for x in ("tool", "calculator", "계산기", "무료 도구"))

def _has_ymyl_text_signal(text):
    raw_text = str(text or "").casefold()
    if any(signal in raw_text for _, signals in _YMYL_TEXT_SIGNAL_GROUPS for signal in signals):
        return True
    normalized_text = normalize_keyword(raw_text)
    return any(signal in normalized_text for signal in _YMYL_NORMALIZED_HANGUL_SIGNALS)

def _ymyl(row):
    keyword = str(row.get("keyword") or "").casefold()
    content_types = str(row.get("content_types") or "").casefold()
    category = str(row.get("category") or "").strip().casefold()
    category_evidence = "" if category.startswith(_NOISY_CATEGORY_PREFIXES) else category
    return (
        _has_ymyl_text_signal(keyword)
        or _has_ymyl_text_signal(content_types)
        or _has_ymyl_text_signal(category_evidence)
    )

def select_launch_candidate(rows, existing_urls=None, published_keywords=None, daily_limit=DAILY_PUBLICATION_LIMIT, selected_at=None, max_age_days=30, launched_count=0):
    existing_urls={identity for x in (existing_urls or set()) if (identity := normalize_url_identity(x)) is not None}; published={normalize_keyword(x) for x in (published_keywords or set())}
    daily_limit=max(0,int(daily_limit)); launched_count=max(0,int(launched_count)); remaining_capacity=max(0,daily_limit-launched_count)
    now=datetime.fromisoformat(selected_at) if selected_at else datetime.now(timezone.utc)
    if now.tzinfo is None: now=now.replace(tzinfo=timezone.utc)
    excluded={"duplicate_url":0,"missing_url":0,"duplicate_keyword":0,"similar_intent":0,"invalid_score":0,"stale_winner":0,"ymyl":0,"ineligible":0,"daily_limit":0,"overlap":0}
    if remaining_capacity == 0:
        excluded["daily_limit"] = 1
        return {"queue": [], "excluded": excluded, "dailyLimit": daily_limit, "remainingCapacity": remaining_capacity}
    published_norm=list(published)
    def rank(r): return (-(1 if r.get("status")=="WINNER" else 0), -(1 if r.get("status")=="CANDIDATE" else 0), -(1 if _tool(r) else 0), -float(r.get("opportunity_score") or 0), normalize_keyword(r.get("keyword")))
    eligible=[]; seen=[]
    for row in sorted(rows, key=rank):
        keyword=str(row.get("keyword") or ""); norm=normalize_keyword(keyword); url=str(row.get("suggested_url") or ""); url_identity=normalize_url_identity(url)
        if not keyword or not _truthy(row.get("score_valid")) or not row.get("opportunity_score") or str(row.get("action","NEW_PAGE")) != "NEW_PAGE": excluded["invalid_score"]+=1; continue
        if row.get("status") in {"PUBLISHED","REJECTED","COOLDOWN","EXPIRED"}: excluded["ineligible"]+=1; continue
        if row.get("status") == "WINNER" and row.get("last_checked"):
            try:
                checked=datetime.fromisoformat(str(row["last_checked"]).replace("Z","+00:00")); checked=checked if checked.tzinfo else checked.replace(tzinfo=timezone.utc)
                if (now-checked).days > max_age_days: excluded["stale_winner"]+=1; continue
            except ValueError: excluded["stale_winner"]+=1; continue
        if _ymyl(row): excluded["ymyl"]+=1; continue
        if norm in published or any(norm == n for _,n in seen): excluded["duplicate_keyword"]+=1; continue
        if any(SequenceMatcher(None,norm,n).ratio() >= .86 for n in published_norm) or any(SequenceMatcher(None,norm,n).ratio() >= .86 for _,n in seen): excluded["similar_intent"]+=1; continue
        if str(row.get("overlap") or "NO_OVERLAP") != "NO_OVERLAP": excluded["overlap"]+=1; continue
        if not url.startswith("/kor/") or not url_identity: excluded["missing_url"]+=1; continue
        if url_identity in existing_urls: excluded["duplicate_url"]+=1; continue
        seen.append((keyword,norm)); eligible.append(row)
    eligible.sort(key=rank)
    queue=[]
    for row in eligible[:remaining_capacity]:
        queue.append({"keyword":row["keyword"],"source":row.get("source") or "KEYWORD_HUNTER","status":"READY_TO_LAUNCH","review_status":"PAGE_REVIEW_READY","opportunity_score":float(row["opportunity_score"]),"confidence":row.get("confidence"),"category":row.get("category"),"intended_page_type":"free_tool" if _tool(row) else "article","suggested_url":row.get("suggested_url"),"duplicate_check":"passed","reason":"winner/tool priority with verified score and no overlap","selected_at":selected_at})
    return {"queue":queue,"excluded":excluded,"dailyLimit":daily_limit,"remainingCapacity":remaining_capacity}
