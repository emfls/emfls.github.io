# Homepage redesign QA — 2026-09-09

- Source visual truth: `/Users/whitesmile/.codex/generated_images/01a0575d-684d-7712-8a7a-e49dd58e036c/exec-b19ca5ff-095d-4b50-a1ea-4be278739129.png`
- Implementation: `http://localhost:4173/`
- Desktop screenshot: `/Users/whitesmile/.codex/.chatgpt-projects/g-p-6a6dbe9c217481918595f22eeb8849f0/emfls-site/reports/homepage-redesign.png`
- Responsive screenshot: `/Users/whitesmile/.codex/.chatgpt-projects/g-p-6a6dbe9c217481918595f22eeb8849f0/emfls-site/reports/homepage-redesign-mobile.png`
- Desktop comparison: source 1488×1056 px and implementation 1488×1056 px, CSS density 1.
- Responsive comparison: implementation 500×844 px, CSS density 1. Chrome headless has a 500 px minimum layout viewport, so this is the captured responsive breakpoint evidence.
- State: dark theme, anonymous visitor, homepage default state. Search suggestion interaction was also tested in the user-selected Chrome session.

## Findings

- No remaining P0/P1/P2 difference. The implementation preserves the selected search-first hierarchy, restrained dark palette, prominent search control, four visual topic entries, popular-content list, update panel and quiet ad area.
- Typography uses Noto Sans KR with Inter for Latin labels. Weight, line-height and hierarchy remain legible at both captured widths.
- Spacing intentionally produces a longer real webpage than the compact concept board; the content order and relative visual priority match the source while touch targets and reading rhythm receive more vertical room.
- Colors use solid overlays and reusable tokens with sufficient foreground contrast. No decorative gradient, emoji icon or handcrafted SVG substitute was introduced.
- Generated photographic assets follow the source art direction and remain sharp after web compression. The Palworld topic image is an original fantasy-game illustration, not copied game artwork.
- Copy uses real emfls destinations and the latest verified 2026-09-09 content rather than the concept board's illustrative titles and dates.

Focused-region comparison was not needed after the full-width captures because the navigation, headline, search control, topic labels and card imagery were readable at original density. The interactive search state was separately inspected in Chrome and returned the camping hub plus the matching Namyangju page.

## Comparison history

1. First responsive capture: P1 — the 390 px headless image cropped the headline and search action because Chrome enforced a wider minimum layout viewport while capturing only 390 pixels.
2. Fix: corrected mobile `min()` width calculations with `calc()`, reduced headline sizing and forced the search input to a zero flex basis so the submit action retains space.
3. Post-fix evidence: the 500×844 responsive capture shows complete headline wrapping, visible search action, all suggestion controls and no horizontal cropping at Chrome's supported minimum layout width.

## Primary interactions and browser checks

- Clicking the `남양주 차박` suggested query fills the search field.
- The result panel opens and exposes the camping hub and Namyangju camping page.
- Existing destination links, canonical, GA4, JSON-LD and AdSense publisher contract remain present.
- Browser rendering completed without page JavaScript errors; Chrome emitted only headless display-process diagnostics while producing screenshots.

## Implementation checklist

- [x] Search-first hero and functional local content search
- [x] Four responsive primary topic cards
- [x] Current popular and recently updated content
- [x] Mobile navigation and accessible focus styles
- [x] Quiet, clearly labeled ad area
- [x] Desktop and responsive visual evidence

final result: passed
