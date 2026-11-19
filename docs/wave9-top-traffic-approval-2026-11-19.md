# Wave 9 Top-Traffic Protected Winner Exact Transition Approval (2026-11-19)

- Authorization: Owner Telegram directive (`update_id=542580474`, 2026-11-19 19:56 KST) explicitly authorizing modifications to previously locked `protectedWinners` pages for AdSense revenue improvement ("너가 수정해야하면 보호잠금따위 필요없다... 너가 수익 개선을 위해서 하는거라면 뭐든지 승인이야").
- Target Count: **34** exact `(before_blob, after_blob)` page transitions (`index.html` + 33 top-traffic Korean pages with 28-day GA4 views >= 53 previously missing full AdSense slot density and cluster recirculation; `kor/report/camp/chuncheon.html` excluded to preserve `test_guard_allows_only_exact_15th_camp_fact_transitions` unmodified).
- Scope & Constraints Preserved:
  - `OBSERVING` experiment locks (`PROTECTED_EXPERIMENT_CHANGED`) remain strictly enforced.
  - Only exact pre-verified `(before_blob, after_blob)` hashes are permitted; any unapproved content hash or deletion remains blocked.
  - All 3 `tests/test_maple_reader_recovery.py` pages preserve their existing `ins == 1` ad-unit contract and receive cluster recirculation only; remaining 30 Korean articles receive balanced 2-slot layout + cluster recirculation; `index.html` receives 1 labeled footer-area display slot safely separated from `#site-search`.
