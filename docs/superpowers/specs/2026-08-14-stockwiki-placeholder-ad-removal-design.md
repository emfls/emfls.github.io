# StockWiki placeholder ad removal design

## Decision

Remove every nonfunctional AdSense placeholder from the 11 StockWiki pages. Do not replace the placeholders with the production publisher ID in this release.

## Why

All 33 explicit units use `ca-pub-XXXXXXXXXXXXXXXX`, none of the pages load the AdSense library, and every page includes a mobile fixed-bottom placeholder. These units cannot produce revenue, while the fixed container and ad-shaped gaps reduce mobile usability and make the repository's policy audit misleading.

## Alternatives considered

1. **Remove all placeholder units (selected):** eliminates dead UI and the fixed-bottom placement without changing real AdSense revenue.
2. Remove only the mobile fixed unit: reduces the largest placement risk but leaves 22 dead ad slots and scripts.
3. Replace placeholders with the production publisher ID: could create revenue, but would activate unmeasured financial-content placements and a custom mobile fixed ad before policy-safe layout validation.

## Scope

- `kor/stockwiki/index.html`
- Ten pages under `kor/stockwiki/stocks/*/index.html`
- Remove placeholder `<ins class="adsbygoogle">` units, their adjacent push scripts, and the mobile fixed-ad container.
- Remove CSS that exists only for those ad containers, including the mobile-only bottom-padding compensation.
- Preserve all stock content, charts, filters, navigation, analytics-neutral behavior, canonical URLs, and disclaimers.

## Verification

- A contract test enumerates all 11 pages.
- Each page must contain no placeholder publisher ID, AdSense unit, push call, `mobile-ad-fixed`, or `ad-slot` markup/CSS.
- Existing stock content and canonical URLs remain present.
- Run focused tests, full relevant regression tests, and `git diff --check` before deployment.
