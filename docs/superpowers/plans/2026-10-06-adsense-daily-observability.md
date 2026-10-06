# AdSense daily observability implementation plan

1. Freeze the latest-main base and current collector/workflow contracts; keep the existing latest snapshot unchanged.
2. Add fixture tests for a bounded daily sidecar, account timezone and currency, additive-only reconciliation, missing versus zero, partial/truncated reports, breakdown availability, validator behavior, CLI, and workflow staging.
3. Extend report parsing and collection with a fail-soft sidecar for the latest two complete seven-day periods: DATE, DATE×COUNTRY, DATE×PLATFORM_TYPE, and DATE×AD_FORMAT. Do not query DATE×PLATFORM_TYPE×AD_FORMAT before actual API compatibility is confirmed; record it as not probed.
4. Add sidecar validation and workflow integration while preserving PAGE_URL's current fail-soft contract and the existing artifact contract.
5. Run focused and repository-required tests/guards, review the diff and generated artifact size, update project history/tasks, commit and push the isolated branch, open a PR, and inspect exact-head CI. Stop before merge for Control Tower review.
