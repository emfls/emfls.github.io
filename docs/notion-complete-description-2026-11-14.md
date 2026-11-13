# Preserve complete Notion descriptions — 2026-11-14

The publisher cut the escaped first paragraph at150 characters, sometimes splitting a sentence or HTML entity. The article template then separately cut the description at165 characters for meta/OG/Twitter/deck while preserving the full JSON-LD value. This produced the incomplete descriptions corrected in the existing-page pilots.

Remove only those two slices. Keep the complete first authored paragraph in the existing summary path, and use the same supplied description across all four rendered placements and Article JSON-LD. Existing HTML escaping, caller unescape and JSON less-than escaping remain intact. No helper, dependency, new publication, bulk regeneration, queue or scheduling change. Short author summaries stay short; a long source introduction produces a taller deck and should be edited at source when a concise editorial summary is preferable.

## Validation

- Two meaningful regressions failed before the fix: first paragraph loss above150, and metadata/deck/JSON mismatch above165. Both pass after the two-line repair. They also cover rich-text removal, entity/literal script safety, body and second-paragraph preservation. Existing tests/assertions unchanged.
- Related publisher/table/invalid-draft/recovery/discovery/Guard/metadata tests:114 passed. Workflow-style unittest discovery:22 passed, including both new regressions. These overlapping test counts are not summed.
- Exact existing workflow inline render checks PASS for the flu and K-sale pages and a future synthetic article through validate_article. Tests use mocked Notion; no account writes or real publication were triggered.
- Independent actual-diff/AST review PASS. Existing source changes are exactly the two slices plus one explanatory comment.
- Offline before/after fixture248-character deck at390/1280px: no clipping, overlapping metadata or horizontal overflow; screenshots visually reviewed. At390px deck height171→285px and1280px86→143px. Executable scripts removed and fixture-only CSP blocked outbound traffic, so no ad request was made.
- No existing HTML changes. Reuse the preceding completed full exact-main static SEO audit; fresh production-source immutable secret/retired-origin scan PASS. Final committed Guard, hosted layout QA, normal PR and Pages follow release and are not preclaimed.

## Limits and rollback

[Google snippet guidance](https://developers.google.com/search/docs/appearance/snippet) permits search-engine selection from page content and display-dependent truncation. Complete metadata does not guarantee the displayed snippet, ranking, CTR or AdSense revenue. This source fix applies to subsequently rendered articles and does not regenerate the old corpus. Observe the next normally scheduled publisher run separately; no manual run or new monitor was created.

Revert this source-fix commit through a normal PR if a concrete regression appears. Existing published summaries and prior pilot releases remain independent and unchanged.
