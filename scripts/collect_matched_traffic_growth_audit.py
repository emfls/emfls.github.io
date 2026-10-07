#!/usr/bin/env python3
"""Collect a bounded, read-only, matched-period GA4 and Search Console audit."""

import argparse
import csv
import json
import os
import re
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
from zoneinfo import ZoneInfo

try:
    from . import collect_ga4_snapshot as ga4
    from . import collect_gsc_snapshot as gsc
    from .collect_gsc_sitewide_query_snapshot import _row_from_api
except ImportError:
    import collect_ga4_snapshot as ga4
    import collect_gsc_snapshot as gsc
    from collect_gsc_sitewide_query_snapshot import _row_from_api


PROPERTY_URL = gsc.PROPERTY_URL
GSC_TIME_ZONE = "America/Los_Angeles"
GSC_FINALIZATION_LAG_DAYS = 3
GSC_MAX_PERIOD_AGE_DAYS = 7
WINDOW_DAYS = 28
PAGE_ROW_LIMIT = gsc.ROW_LIMIT
QUERY_ROW_LIMIT = 1000
QUERY_MAX_PAGES = 3
MAX_CANDIDATES = 10
GSC_QUERY_COMPLETENESS_NOTE = (
    "Search Analytics may omit privacy-filtered or lower-ranked page-query rows. "
    "An absent query row does not mean zero demand, clicks, or impressions."
)
METRICS = ga4.METRICS
SCORECARD_FIELDS = (
    "rank", "url", "title", "h1",
    "currentGscClicks", "priorGscClicks", "currentGscImpressions", "priorGscImpressions",
    "currentGscCtr", "priorGscCtr", "currentGscPosition", "priorGscPosition",
    "currentGa4Views", "priorGa4Views", "currentGa4Users", "priorGa4Users",
    "currentGa4EngagementSeconds", "priorGa4EngagementSeconds",
    "currentGa4TotalAdRevenue", "priorGa4TotalAdRevenue", "ga4RevenueMetric", "trend",
    "currentQueryRows", "priorQueryRows", "currentQueryStatus", "priorQueryStatus", "currentQueryExamples",
    "queryPageFit", "sameLanguageInboundLinks", "sameLanguageInboundSourcePages",
    "trafficBearingInboundLinks", "trafficBearingSourcePages", "organicTrafficBearingInboundLinks",
    "organicTrafficBearingSourcePages", "orphanStatus", "linkScanCompleteness", "inboundLinkExamples",
    "sourceAuthority", "semanticRelevance", "protectionStatus", "exactGap", "recommendedAction", "risk",
)


def _parse_date(value, label):
    try:
        parsed = date.fromisoformat(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} must be an ISO YYYY-MM-DD date") from exc
    if parsed.isoformat() != value:
        raise ValueError(f"{label} must be an ISO YYYY-MM-DD date")
    return parsed


def _parse_timestamp(value, label):
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} must be an ISO-8601 timestamp") from exc
    if parsed.tzinfo is None:
        raise ValueError(f"{label} must include a timezone")
    return parsed


def resolve_periods(gsc_snapshot, *, today=None):
    """Use the latest finalized 28-day GSC snapshot end for both sources."""
    if not isinstance(gsc_snapshot, dict):
        raise ValueError("a VERIFIED GSC page snapshot is required")
    if gsc_snapshot.get("status") != "VERIFIED" or gsc_snapshot.get("source") != gsc.SOURCE:
        raise ValueError("a VERIFIED Search Console API snapshot is required")
    if gsc_snapshot.get("property") != PROPERTY_URL:
        raise ValueError("GSC snapshot property does not match the canonical property")

    source_start = _parse_date(gsc_snapshot.get("periodStart"), "GSC periodStart")
    source_end = _parse_date(gsc_snapshot.get("periodEnd"), "GSC periodEnd")
    if (source_end - source_start).days != WINDOW_DAYS - 1:
        raise ValueError("GSC source snapshot must contain exactly 28 inclusive days")
    today = today or datetime.now(ZoneInfo("Asia/Seoul")).date()
    source_age = (today - source_end).days
    if source_age < GSC_FINALIZATION_LAG_DAYS:
        raise ValueError("GSC source period is not finalized with the required three-day lag")
    if source_age > GSC_MAX_PERIOD_AGE_DAYS:
        raise ValueError("GSC source period is stale; refresh it before the audit")
    generated = _parse_timestamp(gsc_snapshot.get("generatedAt"), "GSC generatedAt")
    if generated.date() > today or (today - generated.date()).days > GSC_MAX_PERIOD_AGE_DAYS:
        raise ValueError("GSC source snapshot is stale or future-dated")

    current_end = source_end
    current_start = current_end - timedelta(days=WINDOW_DAYS - 1)
    prior_end = current_start - timedelta(days=1)
    prior_start = prior_end - timedelta(days=WINDOW_DAYS - 1)
    return {
        "current": {"start": current_start.isoformat(), "end": current_end.isoformat()},
        "prior": {"start": prior_start.isoformat(), "end": prior_end.isoformat()},
        "sourceSnapshotPeriod": {"start": source_start.isoformat(), "end": source_end.isoformat()},
        "sourceSnapshotGeneratedAt": generated.isoformat(),
    }


def route_key(value):
    raw = str(value or "").strip()
    parsed = urlsplit(raw)
    path = unquote(parsed.path or "/").split("#", 1)[0]
    if path.endswith("/index.html"):
        path = path[: -len("index.html")]
    if not path.startswith("/"):
        path = "/" + path
    if path != "/" and not path.endswith("/") and not Path(path).suffix:
        path += "/"
    return path


def _path_for_page_file(repository_root, url):
    route = route_key(url)
    relative = route.lstrip("/")
    if not relative:
        relative = "index.html"
    elif route.endswith("/"):
        relative += "index.html"
    return Path(repository_root) / relative


def _text_key(value):
    return re.sub(r"[^a-z0-9\uac00-\ud7a3]+", "", str(value or "").lower())


def _is_closed_candidate(url, page_context):
    path_key = _text_key(route_key(url))
    text_key = _text_key(" ".join(page_context.get(key, "") for key in ("title", "h1")))
    markers = (
        "가을여행지추천",
        "인건비계산기",
        "엔카중고차구매",
        "urlencoder",
        "urldecoder",
        "베트남한달살기",
        "vietnamonemonth",
        "vietnammonthlylivingcost",
        "vietnamlivingcost",
        "vietnamcost",
        "chiphi1thangtaivietnam",
        "인천공항교통약자우대출구",
        "교통약자우대출구",
        "accessibleexit",
    )
    if any(marker in path_key or marker in text_key for marker in markers):
        return True
    if ("가을" in text_key and "여행지" in text_key and "추천" in text_key):
        return True
    if ("인건비" in text_key and any(token in text_key for token in ("계산", "calculator"))):
        return True
    if ("엔카" in text_key or "encar" in text_key) and any(token in text_key for token in ("중고차", "usedcar")):
        return True
    vietnam = "베트남" in text_key or "vietnam" in text_key
    one_month = any(token in text_key for token in ("한달", "한개월", "1개월", "onemonth", "monthly", "1month", "1thang"))
    cost = any(token in text_key for token in ("생활비", "비용", "cost", "living", "expense", "budget", "chiphi"))
    if vietnam and one_month and cost:
        return True
    incheon = "인천공항" in text_key or "incheonairport" in text_key
    mobility = "교통약자" in text_key or "mobility" in text_key or "reducedmobility" in text_key
    exit_term = "출구" in text_key or "exit" in text_key
    if incheon and mobility and exit_term:
        return True
    return any(
        token in path_key
        for token in (
            "enkajunggocagumae",
            "ingeonbigyesangi",
            "urlencoder",
            "vietnamonemonth",
            "vietnam-cost-one-month",
            "autumn",
            "incheon-airport-accessible",
            "incheon-accessible",
        )
    )


def select_candidates(current_pages, *, protected_urls=(), excluded_urls=(), page_contexts=None, max_candidates=MAX_CANDIDATES):
    """Prioritize returned, nonzero-impression pages; favor positions 4-20."""
    protected = {route_key(value) for value in protected_urls}
    excluded = {route_key(value) for value in excluded_urls}
    page_contexts = page_contexts or {}
    selected = []
    seen = set()
    for page in current_pages:
        if not isinstance(page, dict) or not isinstance(page.get("google"), dict):
            continue
        url = route_key(page.get("url"))
        metrics = page["google"]
        if not url or url in seen or metrics.get("status") != "VERIFIED":
            continue
        seen.add(url)
        impressions = metrics.get("impressions")
        position = metrics.get("position")
        if isinstance(impressions, bool) or not isinstance(impressions, (int, float)) or impressions <= 0:
            continue
        if isinstance(position, bool) or not isinstance(position, (int, float)) or position <= 0:
            continue
        path_segments = [part.lower() for part in url.split("/") if part]
        if url in protected or url in excluded or any("camp" in part for part in path_segments):
            continue
        context = page_contexts.get(url, {})
        if context.get("fileStatus") == "NOT_FOUND":
            continue
        if _is_closed_candidate(url, context):
            continue
        selected.append({
            "url": url,
            "gscPath": str(page.get("url") or url),
            "clicks": metrics.get("clicks"),
            "impressions": impressions,
            "ctr": metrics.get("ctr"),
            "position": position,
            "positionBandPriority": 0 if 4 <= position <= 20 else 1,
        })
    selected.sort(key=lambda item: (item["positionBandPriority"], -item["impressions"], item["position"], item["url"]))
    return selected[:max_candidates]


def build_page_query_request(page_url, period, *, start_row=0, row_limit=QUERY_ROW_LIMIT):
    if row_limit < 1 or row_limit > PAGE_ROW_LIMIT:
        raise ValueError("query rowLimit must be between 1 and 25000")
    if start_row < 0:
        raise ValueError("query startRow must be nonnegative")
    start = _parse_date(period.get("start"), "query period start")
    end = _parse_date(period.get("end"), "query period end")
    if start > end:
        raise ValueError("query period start is after end")
    parsed_page = urlsplit(str(page_url))
    if parsed_page.scheme != "https" or parsed_page.netloc.lower() != urlsplit(PROPERTY_URL).netloc.lower():
        raise ValueError("page query must use a canonical site URL")
    return {
        "startDate": start.isoformat(),
        "endDate": end.isoformat(),
        "dimensions": ["page", "query"],
        "type": "web",
        "dataState": "final",
        "aggregationType": "auto",
        "dimensionFilterGroups": [{
            "groupType": "and",
            "filters": [{"dimension": "page", "operator": "equals", "expression": page_url}],
        }],
        "rowLimit": row_limit,
        "startRow": start_row,
    }


def _metric_value(row, index):
    return ga4._number(ga4._metric(row, index))


def _integral_or_float(value, metric):
    if value is None:
        return None
    if metric in ("screenPageViews", "totalUsers") and value.is_integer():
        return int(value)
    return value


def _ga4_report(rows, *, period, timezone_name, currency_code, dimensioned=True, total_row_count=None, response_metadata=None):
    output_rows = []
    for row in rows or []:
        dimension = ga4._dimension(row) if dimensioned else None
        if dimensioned and not isinstance(dimension, str):
            raise ValueError("GA4 returned a page row without pagePathPlusQueryString")
        metrics = {
            name: _integral_or_float(_metric_value(row, index), name)
            for index, name in enumerate(METRICS)
        }
        if dimensioned:
            output_rows.append({"pagePathPlusQueryString": dimension, **metrics})
        else:
            output_rows.append(metrics)
    return {
        "schemaVersion": 1,
        "source": "GOOGLE_ANALYTICS_DATA_API",
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "dimension": ["pagePathPlusQueryString"] if dimensioned else [],
        "period": {**period, "propertyTimezone": timezone_name},
        "currencyCode": currency_code,
        "rowCount": total_row_count if isinstance(total_row_count, int) and total_row_count >= len(output_rows) else len(output_rows),
        "returnedRowCount": len(output_rows),
        "completeness": (
            "PARTIAL_ROW_LIMIT" if isinstance(total_row_count, int) and total_row_count > len(output_rows)
            else "RETURNED_ROWS_ONLY" if output_rows else "NOT_AVAILABLE"
        ),
        "rows": output_rows if dimensioned else None,
        "siteMetrics": output_rows[0] if not dimensioned and output_rows else None,
        "responseMetadata": {
            "dataLossFromOtherRow": getattr(response_metadata, "data_loss_from_other_row", None),
            "subjectToThresholding": getattr(response_metadata, "subject_to_thresholding", None),
        },
    }


def _index_ga4_pages(snapshot):
    grouped = defaultdict(lambda: {name: [] for name in METRICS})
    for row in snapshot.get("rows") or []:
        path = route_key(row.get("pagePathPlusQueryString"))
        for metric in METRICS:
            grouped[path][metric].append(row.get(metric))
    indexed = {}
    for path, metric_rows in grouped.items():
        metrics = {}
        for metric, values in metric_rows.items():
            if not values or any(value is None for value in values):
                metrics[metric] = None
            else:
                metrics[metric] = sum(values)
        indexed[path] = {"rowCount": len(metric_rows[METRICS[0]]), **metrics}
    return indexed


class PageHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = []
        self.description = ""
        self.h1 = []
        self.links = []
        self._capture = None
        self._anchor = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self._capture = ("title", [])
        elif tag == "h1":
            self._capture = ("h1", [])
        elif tag == "meta" and attrs.get("name", "").lower() == "description":
            self.description = attrs.get("content", "").strip()
        elif tag == "a":
            self._anchor = {"href": attrs.get("href", ""), "text": []}

    def handle_data(self, data):
        if self._capture:
            self._capture[1].append(data)
        if self._anchor is not None:
            self._anchor["text"].append(data)

    def handle_endtag(self, tag):
        if self._capture and ((tag == "title" and self._capture[0] == "title") or (tag == "h1" and self._capture[0] == "h1")):
            text = " ".join(" ".join(self._capture[1]).split())
            if self._capture[0] == "title":
                self.title.append(text)
            else:
                self.h1.append(text)
            self._capture = None
        elif tag == "a" and self._anchor is not None:
            self.links.append({"href": self._anchor["href"], "text": " ".join(" ".join(self._anchor["text"]).split())})
            self._anchor = None


def _read_page_context(repository_root, url):
    page_path = _path_for_page_file(repository_root, url)
    if not page_path.is_file():
        return {"fileStatus": "NOT_FOUND", "title": "", "description": "", "h1": ""}, []
    parser = PageHTMLParser()
    parser.feed(page_path.read_text(encoding="utf-8", errors="replace"))
    return {
        "fileStatus": "FOUND",
        "file": page_path.relative_to(repository_root).as_posix(),
        "title": parser.title[0] if parser.title else "",
        "description": parser.description,
        "h1": " | ".join(parser.h1[:3]),
    }, parser.links


def _locale(path):
    first = route_key(path).strip("/").split("/", 1)[0]
    return first if first in {"kor", "vn", "jp", "cn", "ae", "de", "es", "fr", "id", "in", "pt", "ru"} else "en"


def _collect_inbound_links(repository_root, candidates, current_gsc_pages, ga4_current):
    candidate_keys = {route_key(item["url"]): item["url"] for item in candidates}
    inbound = defaultdict(list)
    gsc_metrics = {route_key(row["url"]): row.get("google", {}) for row in current_gsc_pages}
    ga4_metrics = _index_ga4_pages(ga4_current)
    excluded_parts = {".git", "node_modules", "dist", "build", "vendor"}

    for html_file in Path(repository_root).rglob("*.html"):
        relative_parts = set(html_file.relative_to(repository_root).parts)
        if relative_parts & excluded_parts:
            continue
        source_route = route_key("/" + html_file.relative_to(repository_root).as_posix())
        if source_route.endswith("index.html"):
            source_route = route_key(source_route[: -len("index.html")])
        source_locale = _locale(source_route)
        if all(source_locale != _locale(target) for target in candidate_keys):
            continue
        parser = PageHTMLParser()
        try:
            parser.feed(html_file.read_text(encoding="utf-8", errors="replace"))
        except OSError:
            continue
        for link in parser.links:
            href = link.get("href", "").strip()
            if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
                continue
            resolved = urlsplit(urljoin("https://emfls.github.io" + source_route, href))
            if resolved.netloc and resolved.netloc.lower() not in {"emfls.github.io", "www.emfls.github.io"}:
                continue
            destination = route_key(resolved.geturl())
            target_url = candidate_keys.get(destination)
            if not target_url or source_route == destination or source_locale != _locale(destination):
                continue
            source_gsc = gsc_metrics.get(source_route)
            source_ga4 = ga4_metrics.get(source_route)
            organic = bool(source_gsc and ((source_gsc.get("clicks") or 0) > 0 or (source_gsc.get("impressions") or 0) > 0))
            ga4_views = source_ga4.get("screenPageViews") if source_ga4 else None
            ga4_active = ga4_views is not None and ga4_views > 0
            if organic or ga4_active:
                traffic_status = "TRAFFIC_VERIFIED"
            elif source_gsc is None and source_ga4 is None:
                traffic_status = "NOT_AVAILABLE"
            else:
                traffic_status = "NO_POSITIVE_RETURNED_METRIC"
            inbound[destination].append({
                "sourcePath": source_route,
                "anchorText": link.get("text", ""),
                "gscClicks": source_gsc.get("clicks") if source_gsc else None,
                "gscImpressions": source_gsc.get("impressions") if source_gsc else None,
                "ga4Views": ga4_views,
                "trafficStatus": traffic_status,
                "organicTrafficVerified": organic,
            })
    return inbound


def _make_gsc_service(service_account_info):
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    credentials = service_account.Credentials.from_service_account_info(
        service_account_info,
        scopes=["https://www.googleapis.com/auth/webmasters.readonly"],
    )
    service = build("searchconsole", "v1", credentials=credentials, cache_discovery=False)
    response = service.sites().get(siteUrl=PROPERTY_URL).execute()
    if not isinstance(response, dict) or response.get("siteUrl") != PROPERTY_URL:
        raise ValueError("Search Console property access or identity check failed")
    return service


def _collect_gsc_pages(service, period):
    calls = []

    def fetch(start_row, row_limit):
        response = service.searchanalytics().query(
            siteUrl=PROPERTY_URL,
            body={
                "startDate": period["start"],
                "endDate": period["end"],
                "dimensions": ["page"],
                "type": "web",
                "dataState": "final",
                "aggregationType": "auto",
                "rowLimit": row_limit,
                "startRow": start_row,
            },
        ).execute()
        rows = response.get("rows") or []
        calls.append(len(rows))
        return rows

    rows = gsc.paginate_query(fetch, row_limit=PAGE_ROW_LIMIT)
    for row in rows:
        if row.get("clicks") is None or row.get("impressions") is None:
            raise ValueError("Search Console page row omitted clicks or impressions; refusing to replace missing with zero")
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    snapshot = gsc.build_snapshot(
        rows,
        period_start=period["start"],
        period_end=period["end"],
        generated_at=generated_at,
    ) if rows else {
        "status": "NOT_AVAILABLE",
        "source": gsc.SOURCE,
        "property": PROPERTY_URL,
        "periodStart": period["start"],
        "periodEnd": period["end"],
        "generatedAt": generated_at,
        "periods": {"gsc": period},
        "pages": [],
    }
    snapshot.update({
        "dimension": ["page"],
        "apiRowCount": len(rows),
        "rowCount": len(snapshot["pages"]),
        "pagination": {"pagesFetched": len(calls), "rowLimit": PAGE_ROW_LIMIT, "fetchedRowsPerPage": calls},
        "coverageStatus": "PARTIAL_TOP_ROWS",
        "completenessGuaranteed": False,
        "completenessNote": "Search Analytics does not guarantee all rows; an absent page row is not zero traffic.",
    })
    return snapshot


def _collect_page_queries(service, page_url, period):
    rows = []
    seen = set()
    start_row = 0
    fetched = []
    stopped_because = "safety_ceiling"
    for page_number in range(QUERY_MAX_PAGES):
        response = service.searchanalytics().query(
            siteUrl=PROPERTY_URL,
            body=build_page_query_request(page_url, period, start_row=start_row, row_limit=QUERY_ROW_LIMIT),
        ).execute()
        api_rows = response.get("rows") or []
        if not isinstance(api_rows, list):
            raise ValueError("Search Console query response rows are invalid")
        fetched.append(len(api_rows))
        if not api_rows:
            stopped_because = "zero_rows"
            break
        for api_row in api_rows:
            row = _row_from_api(api_row)
            if route_key(row["page"]) != route_key(page_url):
                raise ValueError("Search Console page filter returned an unexpected page")
            key = (row["page"], row["query"])
            if key in seen:
                raise ValueError("Search Console returned a duplicate page-query row")
            seen.add(key)
            rows.append(row)
        if len(api_rows) < QUERY_ROW_LIMIT:
            stopped_because = "short_page"
            break
        start_row += QUERY_ROW_LIMIT
    return {
        "pageUrl": page_url,
        "period": period,
        "status": "PARTIAL_TOP_ROWS" if rows else "NOT_AVAILABLE",
        "rowCount": len(rows),
        "rows": rows,
        "pagination": {
            "pagesFetched": len(fetched),
            "rowLimit": QUERY_ROW_LIMIT,
            "fetchedRowsPerPage": fetched,
            "stoppedBecause": stopped_because,
            "maxPages": QUERY_MAX_PAGES,
        },
        "completenessGuaranteed": False,
        "completenessNote": GSC_QUERY_COMPLETENESS_NOTE,
    }


def _load_json(path):
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def _url_set(values):
    return {route_key(value) for value in values if value}


def _exclusion_state(repository_root, periods, audit_date):
    root = Path(repository_root)
    revenue = _load_json(root / "data/revenue-opportunities.json")
    protected = _url_set(item.get("url") for item in revenue.get("protectedWinners", []) if isinstance(item, dict))
    excluded = set()
    reasons = defaultdict(set)

    for item in _load_json(root / "data/experiments.json").get("experiments", []):
        if not isinstance(item, dict) or not item.get("url"):
            continue
        status = str(item.get("status", "")).upper()
        observe_until = item.get("observe_until") or item.get("observeUntil")
        observation_overlaps = bool(
            observe_until
            and _parse_date(observe_until, "experiment observeUntil") >= _parse_date(periods["prior"]["start"], "prior period start")
        )
        active_as_of_audit = status in {"ACTIVE", "RUNNING", "OBSERVING", "MONITORING"} and (
            not observe_until or _parse_date(observe_until, "experiment observeUntil") >= audit_date
        )
        if active_as_of_audit or observation_overlaps:
            route = route_key(item["url"])
            excluded.add(route)
            reasons[route].add("ACTIVE_OR_OBSERVATION_EXPERIMENT")

    experiment_path = root / "data/content-launch-experiments.json"
    if experiment_path.exists():
        for item in _load_json(experiment_path).get("experiments", []):
            if not isinstance(item, dict):
                continue
            path = item.get("url") or item.get("path") or item.get("publishedUrl") or item.get("suggestedUrl")
            published = item.get("publishedOn")
            observe_until = item.get("observeUntil") or item.get("observe_until") or item.get("cooldownUntil")
            if not path or not observe_until:
                continue
            observed_end = _parse_date(observe_until, "content launch observeUntil")
            published_day = _parse_date(published, "content launch publishedOn") if published else None
            overlaps_comparison = observed_end >= _parse_date(periods["prior"]["start"], "prior period start")
            launched_before_end = published_day is None or published_day <= _parse_date(periods["current"]["end"], "current period end")
            if overlaps_comparison and launched_before_end:
                route = route_key(path)
                excluded.add(route)
                reasons[route].add("RECENT_CONTENT_LAUNCH_OBSERVATION_WINDOW")

    manifest_path = root / "data/content-launch-manifest.json"
    if manifest_path.exists():
        manifest = _load_json(manifest_path)
        for path in manifest.get("urls", []):
            route = route_key(path)
            excluded.add(route)
            reasons[route].add("LATEST_CONTENT_LAUNCH_MANIFEST")

    for marker, path in (
        ("CLOSED_AUTUMN_TRAVEL_RECOMMENDATION", "/kor/report/travel/국내-겨울-여행.html"),
        ("CLOSED_LABOR_COST_CALCULATOR", "/kor/util/ingeonbigyesangi/"),
        ("CLOSED_ENCAR_PURCHASE_PAGE", "/kor/report/car/used-car-buying-sites-guide.html"),
        ("CLOSED_URL_ENCODER", "/util/url-encoder/"),
        ("CLOSED_VIETNAM_ONE_MONTH_COST", "/report/travel/vietnam-one-month-cost.html"),
        ("CLOSED_INCHeON_ACCESSIBLE_EXIT", "/kor/report/travel/korea-incheon.html"),
    ):
        route = route_key(path)
        excluded.add(route)
        reasons[route].add(marker)
    return protected, excluded, reasons, revenue.get("asOf")


def _trend(current, prior):
    names = ("gscClicks", "gscImpressions", "ga4Views")
    if any(current.get(name) is None or prior.get(name) is None for name in names):
        return "INSUFFICIENT"
    directions = set()
    for name in names:
        if current[name] > prior[name]:
            directions.add("UP")
        elif current[name] < prior[name]:
            directions.add("DOWN")
        else:
            directions.add("SAME")
    if directions == {"SAME"}:
        return "STABLE"
    if "UP" in directions and "DOWN" not in directions:
        return "RISING"
    if "DOWN" in directions and "UP" not in directions:
        return "DECLINING"
    return "MIX_CHANGED"


def _gsc_metrics(page_index, path):
    page = page_index.get(route_key(path))
    if page is None:
        return {"gscClicks": None, "gscImpressions": None, "gscCtr": None, "gscPosition": None}
    metrics = page.get("google", {})
    return {
        "gscClicks": metrics.get("clicks"),
        "gscImpressions": metrics.get("impressions"),
        "gscCtr": metrics.get("ctr"),
        "gscPosition": metrics.get("position"),
    }


def _ga4_metrics(page_index, path):
    row = page_index.get(route_key(path))
    if row is None:
        return {"ga4Views": None, "ga4Users": None, "ga4EngagementSeconds": None, "ga4TotalAdRevenue": None, "ga4Rows": 0}
    return {
        "ga4Views": row.get("screenPageViews"),
        "ga4Users": row.get("totalUsers"),
        "ga4EngagementSeconds": row.get("userEngagementDuration"),
        "ga4TotalAdRevenue": row.get("totalAdRevenue"),
        "ga4Rows": row.get("rowCount", 0),
    }


def _query_index(query_results):
    return {route_key(item["url"]): item for item in query_results}


def _build_scorecard(candidates, gsc_current, gsc_prior, ga4_current, ga4_prior, query_results, inbound, contexts):
    gsc_current_index = {route_key(row["url"]): row for row in gsc_current["pages"]}
    gsc_prior_index = {route_key(row["url"]): row for row in gsc_prior["pages"]}
    ga4_current_index = _index_ga4_pages(ga4_current)
    ga4_prior_index = _index_ga4_pages(ga4_prior)
    query_by_url = _query_index(query_results)
    rows = []
    for rank, candidate in enumerate(candidates, 1):
        path = route_key(candidate["url"])
        current = {**_gsc_metrics(gsc_current_index, path), **_ga4_metrics(ga4_current_index, path)}
        prior = {**_gsc_metrics(gsc_prior_index, path), **_ga4_metrics(ga4_prior_index, path)}
        trend = _trend(
            {"gscClicks": current["gscClicks"], "gscImpressions": current["gscImpressions"], "ga4Views": current["ga4Views"]},
            {"gscClicks": prior["gscClicks"], "gscImpressions": prior["gscImpressions"], "ga4Views": prior["ga4Views"]},
        )
        query_pair = query_by_url.get(path, {})
        current_queries = query_pair.get("current", {}).get("rows", [])
        prior_queries = query_pair.get("prior", {}).get("rows", [])
        link_rows = inbound.get(path, [])
        traffic_links = [item for item in link_rows if item["trafficStatus"] == "TRAFFIC_VERIFIED"]
        organic_links = [item for item in link_rows if item["organicTrafficVerified"]]
        traffic_sources = sorted({item["sourcePath"] for item in traffic_links})
        organic_sources = sorted({item["sourcePath"] for item in organic_links})
        query_examples = [
            f"{row['query']} [clicks={row['clicks']}, impressions={row['impressions']}, position={row['position']}]"
            for row in current_queries[:5]
        ]
        context = contexts.get(path, {})
        rows.append({
            "rank": rank,
            "url": path,
            "title": context.get("title", ""),
            "h1": context.get("h1", ""),
            "currentGscClicks": current["gscClicks"],
            "priorGscClicks": prior["gscClicks"],
            "currentGscImpressions": current["gscImpressions"],
            "priorGscImpressions": prior["gscImpressions"],
            "currentGscCtr": current["gscCtr"],
            "priorGscCtr": prior["gscCtr"],
            "currentGscPosition": current["gscPosition"],
            "priorGscPosition": prior["gscPosition"],
            "currentGa4Views": current["ga4Views"],
            "priorGa4Views": prior["ga4Views"],
            "currentGa4Users": current["ga4Users"],
            "priorGa4Users": prior["ga4Users"],
            "currentGa4EngagementSeconds": current["ga4EngagementSeconds"],
            "priorGa4EngagementSeconds": prior["ga4EngagementSeconds"],
            "currentGa4TotalAdRevenue": current["ga4TotalAdRevenue"],
            "priorGa4TotalAdRevenue": prior["ga4TotalAdRevenue"],
            "ga4RevenueMetric": "totalAdRevenue_CONTEXT_ONLY",
            "trend": trend,
            "currentQueryRows": len(current_queries),
            "priorQueryRows": len(prior_queries),
            "currentQueryStatus": query_pair.get("current", {}).get("status", "NOT_AVAILABLE"),
            "priorQueryStatus": query_pair.get("prior", {}).get("status", "NOT_AVAILABLE"),
            "currentQueryExamples": " | ".join(query_examples),
            "queryPageFit": "REVIEW_REQUIRED",
            "sameLanguageInboundLinks": len(link_rows),
            "sameLanguageInboundSourcePages": len({item["sourcePath"] for item in link_rows}),
            "trafficBearingInboundLinks": len(traffic_links),
            "trafficBearingSourcePages": len(traffic_sources),
            "organicTrafficBearingInboundLinks": len(organic_links),
            "organicTrafficBearingSourcePages": len(organic_sources),
            "orphanStatus": "NO_SAME_LANGUAGE_INBOUND_LINKS" if not link_rows else "SAME_LANGUAGE_INBOUND_LINKS_FOUND",
            "linkScanCompleteness": "FULL_REPOSITORY_HTML_SCAN",
            "inboundLinkExamples": " | ".join(
                f"{item['sourcePath']} → {item['anchorText']} ({item['trafficStatus']})" for item in link_rows[:10]
            ),
            "sourceAuthority": "NOT_MEASURED",
            "semanticRelevance": "REVIEW_REQUIRED",
            "protectionStatus": "NOT_PROTECTED_IN_CURRENT_REVENUE_SNAPSHOT",
            "exactGap": "REVIEW_REQUIRED",
            "recommendedAction": "REVIEW_AFTER_QUERY_AND_HTML_EVIDENCE",
            "risk": "CANNIBALIZATION_AND_PROTECTION_RECHECK_REQUIRED",
        })
    return rows


def _write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")


def _write_csv(path, rows):
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=SCORECARD_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def _collect_ga4_period(property_id, service_account_info, period):
    pages = ga4.collect(property_id, service_account_info, period["start"], period["end"], include_dimension=True)
    site = ga4.collect(property_id, service_account_info, period["start"], period["end"], include_dimension=False)
    metadata = getattr(pages, "metadata", None)
    site_metadata = getattr(site, "metadata", None)
    timezone_name = getattr(metadata, "time_zone", None)
    currency_code = getattr(metadata, "currency_code", None)
    if not timezone_name or not currency_code:
        raise ValueError("GA4 report metadata did not return the property timezone and currency")
    if getattr(site_metadata, "time_zone", None) != timezone_name or getattr(site_metadata, "currency_code", None) != currency_code:
        raise ValueError("GA4 page and site reports disagree on timezone or currency")
    return _ga4_report(
        pages.rows, period=period, timezone_name=timezone_name, currency_code=currency_code,
        total_row_count=getattr(pages, "row_count", None),
        response_metadata=metadata,
    ), _ga4_report(
        site.rows, period=period, timezone_name=timezone_name, currency_code=currency_code,
        dimensioned=False, total_row_count=getattr(site, "row_count", None),
        response_metadata=site_metadata,
    )


def _page_url(path):
    raw = str(path or "/").strip()
    parsed = urlsplit(raw)
    if parsed.scheme in {"http", "https"} and parsed.netloc.lower() == urlsplit(PROPERTY_URL).netloc.lower():
        return parsed._replace(query="", fragment="").geturl()
    raw = parsed.path or "/"
    if not raw.startswith("/"):
        raw = "/" + raw
    return PROPERTY_URL.rstrip("/") + raw


def run_audit(*, repository_root, output_dir, today=None):
    repository_root = Path(repository_root).resolve()
    output_dir = Path(output_dir).resolve()
    source_gsc = _load_json(repository_root / "data/performance/gsc-latest.json")
    periods = resolve_periods(source_gsc, today=today)
    property_id, ga4_info = ga4._credentials_from_env()
    gsc_encoded = __import__("os").environ.get("GA4_SERVICE_ACCOUNT_JSON_B64")
    if not gsc_encoded:
        raise RuntimeError("GA4_SERVICE_ACCOUNT_JSON_B64 is required for Search Console read access")
    gsc_info = gsc.decode_service_account(gsc_encoded)

    gsc_service = _make_gsc_service(gsc_info)
    gsc_current = _collect_gsc_pages(gsc_service, periods["current"])
    gsc_prior = _collect_gsc_pages(gsc_service, periods["prior"])
    ga4_current, ga4_current_site = _collect_ga4_period(property_id, ga4_info, periods["current"])
    property_timezone = ga4_current["period"]["propertyTimezone"]
    currency_code = ga4_current["currencyCode"]
    ga4_prior, ga4_prior_site = _collect_ga4_period(property_id, ga4_info, periods["prior"])
    if ga4_prior["period"]["propertyTimezone"] != property_timezone or ga4_prior["currencyCode"] != currency_code:
        raise ValueError("GA4 property timezone or currency changed between matched reports")

    protected_urls, excluded_urls, exclusion_reasons, protection_as_of = _exclusion_state(
        repository_root, periods, today or datetime.now(ZoneInfo("Asia/Seoul")).date()
    )
    preliminary_candidates = select_candidates(
        gsc_current["pages"],
        protected_urls=protected_urls,
        excluded_urls=excluded_urls,
        max_candidates=min(20, max(1, len(gsc_current["pages"]))),
    )
    contexts = {}
    eligible_candidates = []
    closed_pages_after_html_review = 0
    missing_html_pages = 0
    for candidate in preliminary_candidates:
        context, _ = _read_page_context(repository_root, candidate["url"])
        if context.get("fileStatus") != "FOUND":
            missing_html_pages += 1
            continue
        if _is_closed_candidate(candidate["url"], context):
            closed_pages_after_html_review += 1
            continue
        contexts[candidate["url"]] = context
        eligible_candidates.append(candidate)
    candidates = eligible_candidates[:MAX_CANDIDATES]

    for candidate in candidates:
        candidate["canonicalUrl"] = _page_url(candidate["gscPath"])
    query_results = []
    for candidate in candidates:
        entry = {"url": candidate["url"], "canonicalUrl": candidate["canonicalUrl"]}
        entry["current"] = _collect_page_queries(gsc_service, candidate["canonicalUrl"], periods["current"])
        entry["prior"] = _collect_page_queries(gsc_service, candidate["canonicalUrl"], periods["prior"])
        query_results.append(entry)

    inbound = _collect_inbound_links(repository_root, candidates, gsc_current["pages"], ga4_current)
    scorecard = _build_scorecard(
        candidates, gsc_current, gsc_prior, ga4_current, ga4_prior, query_results, inbound, contexts
    )
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    warnings = [
        "GSC page and page-query rows are returned rows only; GSC does not guarantee all rows.",
        GSC_QUERY_COMPLETENESS_NOTE,
        "GA4 totalAdRevenue is contextual GA4 evidence and is not direct AdSense PAGE_URL revenue.",
        f"GA4 reporting-day timezone is {property_timezone}; Search Console date parameters use Pacific Time ({GSC_TIME_ZONE}). Date labels match, but intraday boundaries differ.",
        "Current GSC pages define the candidate universe. Absent rows are not converted to zero.",
        "Internal link source traffic can be unknown when a source page is absent from returned measurement rows; source authority and semantic relevance require review.",
    ]
    if any(report["completeness"] == "PARTIAL_ROW_LIMIT" for report in (ga4_current, ga4_prior)):
        warnings.append("GA4 dimension row limits truncated one or more reports; unreturned rows are unknown, not zero.")
    if any(report["responseMetadata"].get("dataLossFromOtherRow") for report in (ga4_current, ga4_prior)):
        warnings.append("GA4 reports contain an aggregated other row; page-level coverage is partial.")
    if any(report["responseMetadata"].get("subjectToThresholding") for report in (ga4_current, ga4_prior)):
        warnings.append("GA4 reports are subject to thresholding; absent rows are not zero.")
    metadata = {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "repositoryBase": "aced81068c68924e510c503e2a3517a38688fa6e",
        "periodDays": WINDOW_DAYS,
        "periods": {"current": periods["current"], "prior": periods["prior"]},
        "dateBoundaryTimezones": {"ga4PropertyTimezone": property_timezone, "gscReportingTimezone": GSC_TIME_ZONE},
        "currencyCode": currency_code,
        "sources": {
            "gsc": {
                "source": gsc.SOURCE,
                "property": PROPERTY_URL,
                "snapshotPeriod": periods["sourceSnapshotPeriod"],
                "snapshotGeneratedAt": periods["sourceSnapshotGeneratedAt"],
                "protectedWinnerSnapshotAsOf": protection_as_of,
            },
            "ga4": {"source": "GOOGLE_ANALYTICS_DATA_API", "propertyId": str(property_id), "revenueMetric": "totalAdRevenue_CONTEXT_ONLY"},
        },
        "rowCounts": {
            "gscCurrentApiRows": gsc_current["apiRowCount"],
            "gscCurrentPages": gsc_current["rowCount"],
            "gscPriorApiRows": gsc_prior["apiRowCount"],
            "gscPriorPages": gsc_prior["rowCount"],
            "ga4CurrentDimensionRows": ga4_current["rowCount"],
            "ga4CurrentDimensionRowsReturned": ga4_current["returnedRowCount"],
            "ga4PriorDimensionRows": ga4_prior["rowCount"],
            "ga4PriorDimensionRowsReturned": ga4_prior["returnedRowCount"],
            "candidateQueryCurrentRows": sum(item["current"]["rowCount"] for item in query_results),
            "candidateQueryPriorRows": sum(item["prior"]["rowCount"] for item in query_results),
        },
        "ga4SiteMetrics": {"current": ga4_current_site["siteMetrics"], "prior": ga4_prior_site["siteMetrics"]},
        "candidateScreening": {
            "currentGscReturnedPages": len(gsc_current["pages"]),
            "preliminaryTopPagesForHtmlReview": len(preliminary_candidates),
            "htmlCandidatesChecked": len(preliminary_candidates),
            "existingHtmlPagesInspected": len(preliminary_candidates) - missing_html_pages,
            "closedPagesExcludedAfterHtmlReview": closed_pages_after_html_review,
            "missingRepositoryHtmlExcluded": missing_html_pages,
            "eligiblePagesAfterExclusions": len(eligible_candidates),
            "protectedWinnerUrlsConfigured": len(protected_urls),
            "otherExclusionUrlsConfigured": len(excluded_urls),
            "exclusionReasonUrlCounts": {
                reason: sum(reason in values for values in exclusion_reasons.values())
                for reason in sorted({reason for values in exclusion_reasons.values() for reason in values})
            },
            "candidateRowsCollectedForQueries": len(candidates),
            "candidateSelection": "current returned GSC page rows with impressions > 0 and a returned average position; positions 4-20 are prioritized, then candidates are sorted by current impressions descending, excluding protected, closed/HOLD, camping, active/observation experiment, and recent-launch pages",
        },
        "rawGitTracked": 0,
        "warnings": warnings,
    }
    query_artifact = {
        "schemaVersion": 1,
        "source": gsc.SOURCE,
        "property": PROPERTY_URL,
        "dimensions": ["page", "query"],
        "coverageStatus": "PARTIAL_TOP_ROWS",
        "completenessGuaranteed": False,
        "completenessNote": GSC_QUERY_COMPLETENESS_NOTE,
        "generatedAt": generated_at,
        "periods": {"current": periods["current"], "prior": periods["prior"]},
        "candidateCount": len(query_results),
        "candidates": query_results,
    }
    summary = {
        "result": "MATCHED_TRAFFIC_GROWTH_DECISION_PENDING_REVIEW",
        "currentPeriod": periods["current"],
        "priorPeriod": periods["prior"],
        "rowCounts": metadata["rowCounts"],
        "candidateCount": len(candidates),
        "candidateUrls": [item["url"] for item in candidates],
        "topFiveScorecard": scorecard[:5],
        "rawGitTracked": 0,
        "warnings": warnings,
    }
    _write_json(output_dir / "matched-period-metadata.json", metadata)
    _write_json(output_dir / "gsc-current-pages.json", gsc_current)
    _write_json(output_dir / "gsc-prior-pages.json", gsc_prior)
    _write_json(output_dir / "ga4-current-pages.json", ga4_current)
    _write_json(output_dir / "ga4-prior-pages.json", ga4_prior)
    _write_json(output_dir / "candidate-query-evidence.json", query_artifact)
    _write_csv(output_dir / "candidate-scorecard.csv", scorecard)
    _write_json(output_dir / "summary.json", summary)
    return {
        "outputDir": str(output_dir),
        "rowCounts": metadata["rowCounts"],
        "candidateCount": len(candidates),
        "candidateUrls": [item["url"] for item in candidates],
        "periods": metadata["periods"],
        "warnings": warnings,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repository-root", type=Path, default=Path.cwd())
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    result = run_audit(repository_root=args.repository_root, output_dir=args.output_dir)
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
