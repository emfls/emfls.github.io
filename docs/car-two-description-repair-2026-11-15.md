# Restore two existing car guide summaries

Initial base: `764e6815de97e25ba0ffa39d87abb2b264596ed5`. The hourly publisher subsequently advanced main to `d39c83918e89f9068637f10aaccf0f712eb0048c`; it was merged normally with both target blobs unchanged.

The double-parking guide's visible introduction ends mid-word. Its already complete description is reused for that introduction alone; the four metadata descriptions repaired on November 13 remain intact. This reader-visible follow-up is a separate intervention, so later results cannot isolate the earlier metadata change.

The brake-disc guide's three meta descriptions, Article description and visible introduction end inside an escaped quotation. Five fields now summarize the existing symptoms-to-inspect, vehicle-specific BDC principles and checks before replacement. No operating instructions, diagnosis or claims of current manual verification are added.

Only six substitutions across two HTML files are applied. Body text, title, dates, CSS, executable scripts, links, advertisements and analytics remain intact. The emergency-door guide already has complete descriptions and is excluded.

| Path under `kor/report/car/` | Before blob | After blob |
|---|---|---|
| `ev-double-parking-neutral-n-mode-ioniq5-ev6-2026.html` | `6c1a4dafe0cbd9ef13dfe56a6427015d62027ede` | 380f43e9eef0cb8dbe00636dc2bb0ae007ccf1b7 |
| `electric-car-brake-disc-rust-squeal-bdc-2026.html` | `8a5c534d5f715a9fb8e5cccfacf2335ebd979625` | 714908d8a618e2fe866d005cc1caa7d69c23d084 |

Current and pinned exact WINNER/registered experiment matches are zero; absent page-performance rows leave classification and cooldown UNKNOWN. No protection entries or approvals are changed and absence is not a global SAFE_OPEN declaration.

Independent exact-byte and semantic review, 78 related checks and eight post-change viewport combinations pass. Local CSP blocks external ads and analytics. Existing 11/10 navigation destinations remain unique; this batch does not claim new click-path coverage. Exact-base SEO against that latest base covers 19,527 pages, reusing 19,509 identical parsed records and parsing 18 changed/new files. Parser errors and new critical/warnings are zero; existing 646 critical, 420 warnings and 165 broken links remain. Production inputs and OPS ledgers are preserved.

Committed Guard, normal PR/merge, Pages and exact public-source checks are separate release gates. Actual release evidence is recorded in the associated PR. Search snippet adoption, real-vehicle behavior and revenue effects remain unmeasured. Rollback restores the two exact before blobs through the same protection and release checks.
