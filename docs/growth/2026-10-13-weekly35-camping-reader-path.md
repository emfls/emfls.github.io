# Camping reader path repair

The owner approved a weekly AdSense target of USD 35 and a first-day traffic
diagnosis followed by one evidence-backed repair. This change does not claim
that the target has been reached or that revenue will increase.

## Reproduced defect and scope

The existing auto-camping guide's Open Graph URL uses decomposed Hangul while
its canonical uses composed Hangul. The former returned HTTP 404 and the latter
HTTP 200 on 2026-10-13. Use the existing canonical URL for sharing.

The guide also presented a generic power bank as an EV charging alternative.
Replace that unsupported advice with model-specific manufacturer guidance and
the need to verify charging availability with the facility operator. The primary
reference is [Hyundai's portable charger manual](https://ownersmanual.hyundai.com/full_webhelp/CE1N/2025/ko_KR/id225JAK0N0PF.html).
It applies to the manual's vehicle; the text does not generalize its operating
steps to every vehicle or provide DIY charging instructions.

Add contextual links to the existing Gyeonggi, Pyeongtaek and Suwon camping
guides. Each destination returned HTTP 200 and has its own canonical. Keep the
original related links. This improves navigation; it is not a measured traffic
or revenue lift.

## Protection and verification

- Source page is absent from the exact-main 1,688-WINNER registry and SC044
  observation cohort. The current 14-day GA4 query returned no row for this page;
  that absence is not a zero-revenue or deletion finding.
- No protected destination HTML, measurement input, editorial decision, launch
  queue, counter, advertising code or first publication date is changed.
- Two URL/navigation regression tests failed before the change and passed after.
- Full pytest: 1,556 passed, 3 skipped, one historical Git-blob lookup failed in
  the filtered checkout because sandbox DNS prevented its lazy download. After
  fetching that exact baseline blob, the failed test passed in isolation.
- Static single-page SEO comparison: no new critical issue; title, canonical,
  first publication date, GA4 and AdSense declarations preserved.
- Content Launch Guard passed against base
  `4e6bba67b108689fc09479553d868403c6d19969`.
- Mobile rendering, ad serving, Active View and revenue lift are not measured.
  No new BLOG score or site-wide safety certification is claimed.

Raw analytics and credential material are kept outside this public repository.
The PR remains subject to current-head CI and owner/Control Tower review. No
merge or deployment is performed by this task.
