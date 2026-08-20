# Retired Domain Canonical Audit

- Audit date: 2026-08-20
- Current public origin: `https://emfls.github.io`
- Retired origin checked: `https://emfls.com`
- Scope: all indexable HTML files covered by `tests/test_canonical_inventory.py`
- Incorrect canonical candidates: **0**

## Applied guardrail

`generate_articles.py` and `build_column_page.py` now generate canonical, Open Graph,
breadcrumb, result, and notification URLs from `https://emfls.github.io`. The domain
contract test fails if the retired origin is reintroduced into either generator.

## Verification

- Canonical inventory: 2 checks passed
- Generator domain contract: 2 checks passed
- Full unittest suite: 392 checks passed
