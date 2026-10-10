# Keyword Hunter research-only integration gate

## Current state

The research lane is fixture-only and OFF. It makes no network requests, is not
called by the scheduled Keyword Hunter workflow, and cannot write production
seeds, scoring inputs, launch queues, editorial decisions, manifests, or HTML.
No hypothesis phrases or provider responses are currently approved or captured.

Reviewed hypotheses belong only in
`data/keyword-hunter-research-only/hypotheses.json`. The reader rejects input
over 32 KB and accepts at most six distinct, exact Korean `B1`/`A3` hypotheses
with reviewer and KST review time. A fixture response passed to
`build_capture_bundle` must match the exact phrase and the request hint;
provider rows retain `relKeyword` and raw PC/mobile
counts. `EXACT`, `CENSORED`, `MISSING`, and `INVALID` remain distinct. The
provider's monthly reporting window remains `NOT_AVAILABLE` unless the source
actually supplies it.

Call `verify_capture_bundle` before `write_capture`. The writer stores one
bounded `reports/keyword-hunter/research-only/latest.json` sidecar (2 MB maximum,
1,000 provider rows per hypothesis), atomically replacing a verified previous
run. It rejects a repeated run ID, malformed prior capture, symlink, path
escape, or unexpected sidecar file rather than accumulating artifacts. The
SHA-256 digest detects accidental changes; it is not a signature or proof of
provider authenticity.

## Conditions before any scheduled integration

Do not connect this module to the current scheduled workflow unless a separate
review proves every gate below:

1. A distinct research-only job has no dependency on production collection,
   scoring, queue preparation, persistence, or publication steps.
2. A durable, fail-closed 30-day dedup ledger limits the account to six
   distinct exact phrases in any rolling 30-day period; missing/corrupt ledger
   state stops before a provider request. Retries, timeouts, and 429 handling
   count against a separately documented bounded request budget.
3. Only the dedicated job receives the minimum Search Ads secrets it needs.
   No credential or signed request material is written to fixture or report
   files.
4. The run is enabled only by its natural schedule after separate approval;
   no manual provider dispatch. Test runs use synthetic fixtures only.
5. Output is uploaded as an Actions artifact with 30-day retention. No raw or
   timestamped captures are committed; any tracked summary remains a single
   bounded replacement and keeps missing/censored values explicit.
6. Regression tests prove production seeds, master/scoring, launch queue,
   editorial decisions, publication manifest, protected pages, and existing
   workflow behavior remain unchanged. The operator verifies exact-head CI
   before requesting Control Tower review.

Until these conditions have independent evidence, keep the research lane OFF.
