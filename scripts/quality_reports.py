#!/usr/bin/env python3
"""Render decision-focused Markdown and a private local quality dashboard."""

import html
import json
from collections import Counter


def _priority_pages(pages):
    return sorted(pages, key=lambda row: (-float(row.get("priority", {}).get("score") or 0), row.get("url", "")))


def _top_issues(pages):
    counts = Counter(issue for page in pages for issue in page.get("issues", []))
    return counts.most_common(10)


def render_site_markdown(site, pages, previous=None):
    kpis = site["kpis"]
    lines = [
        "# SITE SCORE", "",
        "## 현재 SITE SCORE", "",
        f"- **{site['score']} / 100 ({site['grade']})**",
        f"- 평가 페이지: {kpis['total_pages']:,}",
        f"- 평균 PAGE_SCORE: {kpis['average_page_score']:.2f}",
        f"- 중앙값 PAGE_SCORE: {kpis['median_page_score']:.2f}",
        f"- 80점 이상 비율: {kpis['pages_80_plus_ratio']:.1%} (목표 80%)",
        f"- 60점 미만 비율: {kpis['pages_under_60_ratio']:.1%} (목표 3% 이하)", "",
    ]
    if previous and previous.get("rules_version") == site.get("rules_version"):
        change = site["score"] - previous.get("score", 0)
        if change:
            lines.extend((f"- 이전 실행 대비 SITE_SCORE: {change:+d}", ""))
    lines.extend(("## 영역별 점수", "", "| 영역 | 점수 |", "|---|---:|"))
    lines.extend(f"| {name} | {value['score']} / {value['max']} |" for name, value in site["scores"].items())
    lines.extend(("", "## 등급 분포", ""))
    lines.append("- " + ", ".join(f"{grade} {count:,}" for grade, count in kpis["grades"].items()))
    lines.extend(("", "## 가장 큰 사이트 문제", ""))
    issues = _top_issues(pages)
    lines.extend(f"{index}. `{issue}` — {count:,}페이지" for index, (issue, count) in enumerate(issues, 1))
    if not issues:
        lines.append("- 자동 감사에서 집계된 문제가 없습니다.")
    lines.extend(("", "## 가장 먼저 개선할 페이지", ""))
    for index, page in enumerate(_priority_pages(pages)[:10], 1):
        recommendation = page.get("recommendations", ["수동 검토가 필요합니다."])[0]
        priority = page.get("priority", {})
        lines.append(
            f"{index}. `{page['url']}` — PAGE_SCORE {page['score']}, priority {priority.get('score', 0):.2f} "
            f"({priority.get('basis', 'ESTIMATED')}): {recommendation}"
        )
    lines.extend(("", "## AdSense $100/day", ""))
    goal = site.get("revenue_goal") or {"status": "DATA NOT AVAILABLE"}
    if goal.get("status") == "VERIFIED":
        period = goal.get("period") or {}
        period_label = "과거 데이터 기간" if goal.get("label") == "historical_period_daily_average" else "데이터 기간"
        lines.extend((
            f"- {period_label}: {period.get('start', '알 수 없음')} ~ {period.get('end', '알 수 없음')}",
            f"- 기간 일평균 수익: ${goal['daily_revenue_usd']:.2f}",
            f"- 목표 달성률: {goal['achievement_rate']:.1%}",
            f"- 필요 성장: {goal['required_growth']:.2f}x" if goal.get("required_growth") else "- 필요 성장: DATA NOT AVAILABLE",
            f"- 현재 RPM 기준 필요 PV: {goal['required_page_views']:,}",
        ))
    else:
        lines.append("- DATA NOT AVAILABLE")
    lines.extend(("", "## 데이터 제한", ""))
    lines.extend((
        f"- GSC: {site.get('connections', {}).get('gsc', 'NOT_CONNECTED')}",
        f"- GA4: {site.get('connections', {}).get('ga4', 'NOT_CONNECTED')}",
        "- URL별 AdSense 수익/RPM: NOT_CONNECTED",
        "- 경쟁 페이지 대비 가치, 실제 모바일 UX, AI·복붙 판정은 수동 검토가 필요합니다.",
        "- 낮은 점수만으로 페이지를 삭제하거나 noindex하지 않습니다.",
        "", "## 다음 작업", "",
    ))
    if pages:
        top = _priority_pages(pages)[0]
        lines.append(f"- `{top['url']}`의 첫 번째 구체적 권장사항을 성과 데이터와 함께 검토합니다.")
    else:
        lines.append("- 평가 가능한 index 페이지가 없습니다.")
    return "\n".join(lines).rstrip() + "\n"


def _revenue_metric(revenue, name, prefix="", decimals=2):
    metric = (revenue.get("kpis") or {}).get(name) or {}
    value = metric.get("value")
    status = metric.get("status", "NOT_CONNECTED")
    shown = "N/A" if value is None else f"{prefix}{value:,.{decimals}f}"
    return f'<div class="card"><div>{html.escape(name)}</div><div class="score">{shown}</div><small>{html.escape(status)}</small></div>'


def _render_revenue_control_center(revenue):
    if not revenue:
        return ""
    counts = revenue.get("classificationCounts") or {}
    opportunities = revenue.get("topOpportunities") or []
    winners = revenue.get("protectedWinners") or []
    experiments = revenue.get("activeExperiments") or []
    camping = revenue.get("campingCluster") or {}
    top_rows = []
    for index, row in enumerate(opportunities[:10], 1):
        top_rows.append(
            "<tr>"
            f"<td>{index}</td><td>{html.escape(str(row.get('url', '')))}</td>"
            f"<td>{float(row.get('revenueOpportunityScore') or 0):.2f}</td>"
            f"<td>{html.escape(str(row.get('classification') or 'INSUFFICIENT_DATA'))}</td>"
            f"<td>{html.escape(str(row.get('nextAction') or 'WAIT_FOR_DATA'))}</td>"
            f"<td>{'YES' if row.get('cooldown') else 'NO'}</td>"
            f"<td>{html.escape(str(row.get('dataStatus') or 'INSUFFICIENT_DATA'))}</td>"
            "</tr>"
        )
    winner_rows = "".join(
        f"<li><code>{html.escape(str(row.get('url', '')))}</code> — PROTECT</li>" for row in winners
    ) or "<li>검증된 URL별 수익 데이터가 없습니다.</li>"
    experiment_rows = "".join(
        f"<li>{html.escape(str(row.get('experiment_id', '')))} — {html.escape(str(row.get('status', 'OBSERVING')))}</li>"
        for row in experiments
    ) or "<li>활성 실험이 없습니다.</li>"
    count_cards = "".join(
        f'<div class="card"><div>{name}</div><div class="score">{int(counts.get(name, 0)):,}</div></div>'
        for name in ("WINNER", "OPPORTUNITY", "EXPERIMENT", "DEAD_CANDIDATE")
    )
    return f"""<section id="revenue-control"><h1>REVENUE GROWTH CONTROL CENTER</h1>
<p>현재 단계: <strong>{html.escape(str(revenue.get('phase', 'DATA NOT AVAILABLE')))}</strong></p>
<div class="cards">{_revenue_metric(revenue, 'revenue28d', '$')}{_revenue_metric(revenue, 'dailyAverage28d', '$')}{_revenue_metric(revenue, 'revenuePerIndexedPage', '$', 6)}{_revenue_metric(revenue, 'viewsPerActiveUser')}{_revenue_metric(revenue, 'winnerRevenueConcentration')}</div>
<h2>Opportunity</h2><div class="cards">{count_cards}</div>
<h2>TODAY'S TOP OPPORTUNITIES</h2><div class="wrap"><table><thead><tr><th>#</th><th>URL</th><th>Score</th><th>Classification</th><th>Next action</th><th>Cooldown</th><th>Data</th></tr></thead><tbody>{''.join(top_rows)}</tbody></table></div>
<div class="cards"><div class="card"><h2>WINNERS - DO NOT REWRITE</h2><ul>{winner_rows}</ul></div><div class="card"><h2>ACTIVE EXPERIMENTS</h2><ul>{experiment_rows}</ul></div></div>
<div class="card"><h2>Camping Cluster</h2><p>Pages: {int(camping.get('pages') or 0):,} · Views: {camping.get('views') if camping.get('views') is not None else 'N/A'} · Revenue: {camping.get('revenue') if camping.get('revenue') is not None else 'N/A'} · Revenue / 1000 views: {camping.get('revenuePer1000Views') if camping.get('revenuePer1000Views') is not None else 'N/A'} · Naver URL data: {html.escape(str(camping.get('naverStatus', 'NOT_CONNECTED')))}</p></div></section>"""


def render_dashboard(site, pages, revenue=None):
    safe_pages = [
        {
            "url": page.get("url"), "score": page.get("score"), "grade": page.get("grade"),
            "type": page.get("type"), "status": page.get("status"), "issues": page.get("issues", []),
            "recommendations": page.get("recommendations", []), "priority": page.get("priority", {}),
        }
        for page in pages
    ]
    payload = json.dumps(safe_pages, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    grades = " ".join(f"{grade} {count}" for grade, count in site["kpis"]["grades"].items())
    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Local Site Quality Dashboard</title>
<style>body{{font-family:system-ui,sans-serif;margin:0;background:#f5f7fb;color:#18212f}}main{{max-width:1200px;margin:auto;padding:24px}}.cards{{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}}.card{{background:white;border:1px solid #dbe3ee;border-radius:12px;padding:16px}}.score{{font-size:2rem;font-weight:800}}label{{display:grid;gap:4px}}.filters{{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:20px 0}}input,select,button{{font:inherit;padding:10px}}table{{width:100%;border-collapse:collapse;background:white}}th,td{{padding:10px;border-bottom:1px solid #e6ebf2;text-align:left}}.wrap{{overflow-x:auto}}#detail{{white-space:pre-wrap}}@media(max-width:640px){{main{{padding:12px}}}}</style></head>
<body><main>{_render_revenue_control_center(revenue)}<section id="page-score"><h1>사이트 품질 관리자 — 로컬 전용</h1><h2>PAGE SCORE</h2><div class="cards"><div class="card"><div>SITE SCORE</div><div class="score">{site['score']} / 100</div><div>{html.escape(str(site['grade']))}</div></div><div class="card"><div>전체 페이지</div><div class="score">{site['kpis']['total_pages']:,}</div></div><div class="card"><div>등급</div><p>{html.escape(grades)}</p></div><div class="card"><div>$100/day</div><p>{html.escape(str(site.get('revenue_goal', {}).get('status', 'DATA NOT AVAILABLE')))}</p></div></div>
<div class="filters"><label>URL 검색<input id="url-filter" type="search"></label><label>등급<select id="grade-filter"><option value="">전체</option><option>S</option><option>A</option><option>B</option><option>C</option><option>D</option><option>F</option></select></label><label>유형<select id="type-filter"><option value="">전체</option><option>TRAFFIC</option><option>MONEY</option><option>HUB</option><option>TOOL</option><option>TRUST</option><option>UTILITY</option></select></label><label>상태<select id="status-filter"><option value="">전체</option><option>FAIL</option><option>NEEDS_WORK</option><option>PUBLISHABLE</option><option>GOOD</option><option>CORE</option></select></label></div>
<p>100 rows per page · <span id="count"></span></p><div class="wrap"><table><thead><tr><th>URL</th><th>점수</th><th>등급</th><th>유형</th><th>상태</th><th>우선순위</th></tr></thead><tbody id="rows"></tbody></table></div><p><button id="prev">이전</button> <button id="next">다음</button></p><div class="card"><h2>페이지 상세</h2><div id="detail">행을 선택하세요.</div></div>
<script>const pages={payload};const size=100;let current=0;const $=id=>document.getElementById(id);function filtered(){{const q=$("url-filter").value.toLowerCase(),g=$("grade-filter").value,t=$("type-filter").value,s=$("status-filter").value;return pages.filter(x=>(!q||x.url.toLowerCase().includes(q))&&(!g||x.grade===g)&&(!t||x.type===t)&&(!s||x.status===s));}}function render(){{const list=filtered();const max=Math.max(0,Math.ceil(list.length/size)-1);current=Math.min(current,max);$("count").textContent=`${{list.length}} pages`;$("rows").innerHTML="";list.slice(current*size,(current+1)*size).forEach(x=>{{const tr=document.createElement("tr");tr.innerHTML=`<td>${{x.url}}</td><td>${{x.score}}</td><td>${{x.grade}}</td><td>${{x.type}}</td><td>${{x.status}}</td><td>${{x.priority.score||0}} (${{x.priority.basis||"ESTIMATED"}})</td>`;tr.onclick=()=>$("detail").textContent=JSON.stringify({{issues:x.issues,recommendations:x.recommendations}},null,2);$("rows").appendChild(tr);}});}}["url-filter","grade-filter","type-filter","status-filter"].forEach(id=>$(id).oninput=()=>{{current=0;render();}});$("prev").onclick=()=>{{current=Math.max(0,current-1);render();}};$("next").onclick=()=>{{current++;render();}};render();</script></section></main></body></html>"""
