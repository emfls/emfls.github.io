# SAFE_AUTO_PUBLISH foundation (Phase 8-1)

SAFE_AUTO is disabled by default (`data/safe-auto-page-families.json`). Only explicitly registered deterministic families can be eligible; generic articles remain `PAGE_REVIEW_READY`, while YMYL, overlap, duplicates, HOLD, UPDATE_EXISTING, invalid scores, and exhausted daily capacity are `BLOCKED`.

The foundation performs eligibility resolution and a dry-run HTML generation contract only. It never writes the publication manifest, durable ledger, counter, or main. A future transaction must run tests → launch guard → generated-file QA → deployment/live checks, and finalize publication only after all gates succeed; deployment failure leaves the candidate unfinalized and requires compensating cleanup before retry.
