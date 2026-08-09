# Sixth GA4 Priority Batch Design

## Goal

Improve ten pages with verified recent GA4 users while preserving every existing game and tool function. The batch prioritizes stable search intent, honest limitations, mobile ad stability, and crawlable page context.

## Selected pages

Recent GA4 export (2026-07-04 to 2026-07-31): `/ru/game/MBTI` (154 sessions/130 users), `/es/game/STOPat5` (45/42), NVIDIA SEC report (41/41), `/cn/game` (39/29), Japanese CRC (33/27), Chinese case converter (23/23), Korean team generator (23/23), Chinese 3D dice (22/18), Korean 3D dice (21/18), and English QR tool (20/18).

## Content contract

- Use a trailing-slash canonical for directory pages and the exact `.html` canonical for the SEC report.
- Add or correct `WebApplication`, `VideoGame`, `CollectionPage`, `Article`, and `FAQPage` structured data according to page purpose.
- Display `2026-08-09` as the reviewed date.
- Explain that MBTI is entertainment, browser randomness is not audited or cryptographic, CRC is not encryption, case conversion is not translation, and QR content can expose secrets to anyone who scans it.
- Describe input processing accurately: tool input stays in the browser, while analytics and advertising services may still receive ordinary usage/device data.
- Link the NVIDIA summary to the official SEC filing, distinguish fiscal year end from filing date, and state that the summary is not investment advice.
- Constrain responsive ad frames to the viewport without changing ad code or placement.

## Verification

Automated tests check all ten URLs, schema types, reviewed dates, limitations, canonical URLs, analytics/AdSense presence, and core application markers. The full repository test suite and inline JavaScript syntax checks must pass before publishing.
