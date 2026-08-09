# Seventh GA4 Priority Batch Design

## Goal and selection

Improve ten previously untouched pages with verified GA4 traffic from 2026-07-04 through 2026-07-31: five Korean game/update articles, three Russian browser tools, the Korean case converter, and Japanese Connect Four.

## Design

- Preserve the existing tools, games, and article bodies while adding a clear reviewed date and concise, purpose-specific guidance.
- Treat game performance numbers and update details as observations that can change after patches; remove or qualify guaranteed earnings, fixed efficiency, and “perfect” claims.
- Explain browser-tool limits accurately: random shuffle is not cryptographic, notes use local browser storage, diff is line-oriented, and case conversion is not translation or Korean grammatical rewriting.
- Give Japanese Connect Four a trailing-slash canonical, game instructions, draw/restart behavior, and `VideoGame`/`FAQPage` schema.
- Add appropriate `Article`, `WebApplication`, `VideoGame`, and `FAQPage` structured data, accurate `dateModified`, related internal links, and mobile-safe ad-frame CSS.
- Record the batch in the growth log and validate all ten pages with focused and full regression tests.

## Success criteria

- All ten pages expose a unique canonical, reviewed date `2026-08-09`, purpose-specific limitations, and relevant structured data.
- Existing interactive markers remain present and JavaScript parses successfully.
- Focused tests, the complete test suite, and `git diff --check` pass.
