# AdSense snapshot storage and retention

The collector keeps the existing `data/performance/adsense-latest.json` contract and stores a second, bounded diagnostic view at `data/performance/adsense-diagnostics-latest.json`. The diagnostic file covers the two adjacent seven-day periods ending on the latest completed Asia/Seoul date. It retains 14 daily rows, up to 32 returned platform and ad-format categories per period, and the top 20 returned countries per period. Country selection is ranked by estimated earnings descending, then page views descending, then country name ascending. If estimated earnings are not available for every returned country, page views are the fallback; if those are also incomplete, names sort alphabetically. Omitted countries are unknown, are not combined into `other`, and must not be interpreted as zero.

Dimension summaries sum only additive measures. Page RPM and CPC use estimated earnings divided by page views or clicks, and request coverage uses matched requests divided by ad requests. These definitions follow the [AdSense Management API metric reference](https://developers.google.com/adsense/management/metrics-dimensions). Active View viewability is null at summary grain because the collected rows do not include a compatible additive denominator. `DATE × PLATFORM_TYPE × AD_FORMAT` remains `NOT_AVAILABLE` / `NOT_PROBED_ACTUAL_API_COMPATIBILITY`; no three-way API compatibility claim is made.

The full DATE, DATE × COUNTRY, DATE × PLATFORM_TYPE, DATE × AD_FORMAT rows and their report metadata are written under `$RUNNER_TEMP/adsense-breakdown-latest.json`. The workflow validates that file and uploads it as `adsense-breakdown-${{ github.run_id }}-${{ github.run_attempt }}` with seven-day retention. `$RUNNER_TEMP` is outside the checkout, so the raw report is not in the Git working tree, Git commits, or a Pages deployment payload. The upload step runs even if compact diagnostic construction or validation fails, when the raw file exists.

## Storage layers

- **Checkout size** is the current checked-out working tree. It does not describe old file versions retained by Git.
- **Tracked current size** is the size of the files in the current Git tree. The tracked diagnostic has a hard ceiling of 256 KiB; an oversized file fails validation and cannot be committed by this workflow.
- **`.git` history** retains prior blobs when a tracked latest file changes. Replacing `adsense-diagnostics-latest.json` therefore does not mean Git history does not grow. The 256 KiB cap bounds one diagnostic blob, not cumulative history growth.
- **GitHub repository history** reflects the pushed commit and blob history. It is separate from the current checkout's working-tree size and from Actions artifacts.
- **GitHub Actions artifact storage** holds the full raw breakdown for seven days, then expires it under the artifact retention policy. It is not a Git commit or a site payload.
- **Pages deploy payload** is assembled from the repository's published branch and deployment rules. Tracked latest snapshots may be present according to those rules; runner-temp raw detail is outside the checkout and is never part of that payload.

The collector preserves `null` for unavailable metrics and absent dimension-period summaries. It records explicit zeros as zero, reports warnings and truncation as partial evidence, and does not aggregate Active View viewability across periods because a compatible additive denominator is unavailable. The diagnostic includes the source, generation time, account reporting timezone, currency, date range, completeness, source row counts, warnings, and omission caveats. The raw Actions artifact retains full report rows and metadata for follow-up inspection.

`adsense-latest.json` remains the input consumed by existing revenue code. This storage change does not alter its schema or report period contract.
