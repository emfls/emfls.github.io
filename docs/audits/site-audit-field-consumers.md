# `site-audit.json` field and consumer audit

## Size regression

The base artifact has 19,066 rows and is 16,296,694 bytes. The PR head has 19,030 rows and is 100,167,019 bytes. The current row count is lower; the increase comes from new per-page fields. The largest serialized contributions are approximate field values plus keys across all page rows:

| Field | Approx. bytes | Share of full artifact |
|---|---:|---:|
| `visible_text_prefix` | 73,007,431 | 72.89% |
| `description` | 5,522,746 | 5.51% |
| `internal_link_targets` | 3,904,268 | 3.90% |
| `title` | 1,825,110 | 1.82% |
| `canonical` | 1,414,735 | 1.41% |
| `structured_data_types` | 1,188,547 | 1.19% |
| `path` | 873,447 | 0.87% |
| `url` | 863,057 | 0.86% |

The 16 fields added after the base schema contribute about 82.9 MB in total. Minified serialization was already in use. Restricting the committed audit to the 20 page fields in the base artifact produces a 16,270,166-byte inventory for the current 19,030 rows.

## Consumer rules

- **REQUIRED_COMMITTED** — a downstream reader of the committed inventory needs the field.
- **REQUIRED_TRANSIENT** — scoring or quality calculations need it from the full runtime audit; do not persist it in Git.
- **DERIVABLE** — generated from HTML or the audit summary and not needed by a downstream reader of the committed page rows.
- **UNUSED** — no downstream script reference was found.

The compact writer retains all 20 pre-PR page fields to keep the existing artifact shape stable. A few of those fields are only consumed while scoring; retaining their small legacy values is deliberate and is not a second schema migration. All field values can be regenerated from the current HTML; `REQUIRED_COMMITTED` describes where consumers currently read them.

## Top-level fields

| Field | Classification | Consumer |
|---|---|---|
| `pages` | REQUIRED_COMMITTED | All readers below operate on its page rows. |
| `summary` | DERIVABLE | `seo_audit.py` CLI output and Markdown report; recomputed from rows. |
| `parser_errors` | DERIVABLE | `seo_audit.py` Markdown report; recomputed during parsing. |

## Per-page fields

| Field | Classification | Consumer |
|---|---|---|
| `path` | REQUIRED_COMMITTED | `seo_qa.py`, `content_launch_guard.py`, `apply_breadcrumb_metadata.py`, `apply_related_links.py`, `finance_content_audit.py`, `recommend_internal_links.py`. |
| `url` | REQUIRED_COMMITTED | `seo_qa.py`, `quality_audit.py`, `revenue_growth.py`, `sitemap_audit.py`, `score_content_priority.py`, `recommend_internal_links.py`, `apply_related_links.py`, `apply_breadcrumb_metadata.py`, `content_health_reports.py`, `content_launch_guard.py`, `validate_content_metadata.py`, `finance_content_audit.py`. |
| `title` | REQUIRED_COMMITTED | `quality_audit.py`, `seo_qa.py`, `score_content_priority.py`, `recommend_internal_links.py`, `apply_related_links.py`, `apply_breadcrumb_metadata.py`, `content_health_reports.py`, `content_launch_guard.py`, `validate_content_metadata.py`, `finance_content_audit.py`. |
| `description` | REQUIRED_COMMITTED | `seo_qa.py` and `quality_audit.py` duplicate checks. |
| `language` | REQUIRED_COMMITTED | `recommend_internal_links.py`, `apply_related_links.py`, `apply_breadcrumb_metadata.py`. |
| `category` | REQUIRED_COMMITTED | `recommend_internal_links.py`, `apply_breadcrumb_metadata.py`, `content_health_reports.py`, `validate_content_metadata.py`. |
| `published_date` | REQUIRED_COMMITTED | `content_health_reports.py`, `validate_content_metadata.py`. |
| `updated_date` | REQUIRED_COMMITTED | `recommend_internal_links.py`, `score_content_priority.py`, `apply_breadcrumb_metadata.py`, `content_health_reports.py`, `validate_content_metadata.py`. |
| `word_count` | REQUIRED_COMMITTED | `recommend_internal_links.py`, `score_content_priority.py`, `finance_content_audit.py`. |
| `h1_count` | REQUIRED_COMMITTED | `seo_qa.py`, `score_content_priority.py`. |
| `h2_count` | REQUIRED_TRANSIENT | `quality_scoring.py` structure and depth checks. |
| `h3_count` | UNUSED | No downstream consumer found; omitted from the compact inventory. |
| `internal_links` | REQUIRED_COMMITTED | `score_content_priority.py`. |
| `internal_link_targets` | REQUIRED_TRANSIENT | `quality_audit.py` inbound-link counts and orphan scoring. |
| `external_links` | REQUIRED_COMMITTED | `finance_content_audit.py`, `score_content_priority.py`. |
| `images` | REQUIRED_TRANSIENT | `quality_scoring.py` media checks. |
| `image_alt_missing` | REQUIRED_TRANSIENT | `quality_scoring.py` image accessibility check. |
| `has_viewport` | REQUIRED_TRANSIENT | `quality_scoring.py` mobile-readiness checks. |
| `has_table` | REQUIRED_TRANSIENT | `quality_scoring.py` content and overflow checks. |
| `has_table_overflow` | REQUIRED_TRANSIENT | `quality_scoring.py` mobile-readiness check. |
| `has_form` | REQUIRED_TRANSIENT | `quality_scoring.py` interaction and content-first checks. |
| `has_breadcrumb` | REQUIRED_TRANSIENT | `quality_audit.py` site ratio and `quality_scoring.py` page score. |
| `has_related_section` | REQUIRED_TRANSIENT | `quality_scoring.py` navigation score. |
| `has_author_signal` | REQUIRED_TRANSIENT | `quality_scoring.py` trust score. |
| `has_method_signal` | REQUIRED_TRANSIENT | `quality_scoring.py` trust score. |
| `has_limitation_signal` | REQUIRED_TRANSIENT | `quality_scoring.py` trust score. |
| `has_about_methodology_link` | REQUIRED_TRANSIENT | `quality_scoring.py` trust-context score. |
| `has_parent_hub_link` | REQUIRED_TRANSIENT | `quality_scoring.py` navigation score. |
| `has_intrusive_popup` | REQUIRED_TRANSIENT | `quality_scoring.py` ad-experience score. |
| `interactive_controls` | REQUIRED_TRANSIENT | `quality_scoring.py` interaction checks. |
| `visible_text_prefix` | REQUIRED_TRANSIENT | `quality_scoring.py` answer-first, trust, and core-content checks. |
| `structured_data_types` | REQUIRED_COMMITTED | `quality_audit.py`, `score_content_priority.py`. |
| `canonical` | REQUIRED_COMMITTED | `seo_qa.py`, `quality_audit.py`, `revenue_growth.py`, `sitemap_audit.py`. |
| `indexable` | REQUIRED_COMMITTED | `quality_audit.py`, `revenue_growth.py`, `sitemap_audit.py`, `recommend_internal_links.py`, `finance_content_audit.py`, `score_content_priority.py`. |
| `adsense` | REQUIRED_TRANSIENT | `quality_scoring.py` ad-experience check. |
| `ga4` | DERIVABLE | Used to calculate the audit's site-level GA4 coverage summary; page flag is regenerated from HTML. |
| `parse_warnings` | DERIVABLE | `seo_audit.py` report generation; warnings are regenerated while parsing. |

`quality_audit.py` is the only consumer that needs `internal_link_targets`; it also calls `quality_scoring.py`, which needs the excerpt and quality diagnostics. The SEO QA workflow now supplies both scoring calls from `/tmp/site-audit-full.json`. `seo_qa.py` continues reading the compact committed inventory. GA4 and GSC collection already write an explicit full audit under `/tmp` and continue using that path.

## Generated artifact scope

This change is limited to `data/site-audit.json`. `data/page-performance.json`, `data/page-scores.json`, and `data/revenue-opportunities.json` remain unchanged; review their retention policy in a separate, scoped task.
