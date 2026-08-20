# AdSense Placement Safety Audit

- Audit date: 2026-08-20
- Revenue objective: grow organic traffic and page value without optimizing AdSense CTR
- Official policy basis: [Google AdSense ad placement policies](https://support.google.com/adsense/answer/1346295?hl=en), [invalid traffic definition](https://support.google.com/adsense/answer/16737?hl=en)

## Data finding

The supplied daily export covers 2023-08-01 through 2026-08-01. Its latest 90-day
window contains 8,452 page views, 363 clicks, $9.67 estimated earnings, 4.29% page
CTR, and $1.14 page RPM. Four dates exceeded the internal 10% daily review trigger:
2026-05-09, 2026-05-11, 2026-05-15, and 2026-05-16.

This is not a policy-violation finding. The CSV does not identify the URL, device,
country, traffic source, or ad unit responsible for those dates.

The other supplied exports are aggregate reports for a different or unspecified
period, so they must not be joined to the 90-day dates as though they were aligned.
They show that `emfls.github.io` historically had 47,729 page views and 1,248 clicks
(2.61% calculated page CTR). Historical traffic-source CTR was higher for Naver
(5.50%) than Bing (2.54%), direct (1.58%), or Google (1.26%), but this is only a
review lead because the periods cannot be reconciled from the exports.

## Code and placement inventory

- HTML files containing the AdSense loader or ad code: 18,491
- HTML files containing a manual `<ins class="adsbygoogle">` unit: 355
- Manual-ad pages also containing interactive-control markup: 33 review candidates
- High-risk dice and fortune tools covered by explicit spacing tests: 26 language pages
- Existing guardrail: 80px control-to-ad spacing, visible neutral ad label, and no ad-click tracking

The 33 candidates are an intentionally broad regex inventory, not 33 confirmed
violations. Content pages can contain ordinary navigation or search controls far from
the ad. The inventory is retained as the manual/mobile review queue.

## Decision

- Do not add ads or move ads closer to controls.
- Keep the 80px safety spacing and neutral `Advertisement` label on interactive tools.
- Do not track or infer individual ad clicks in GA4 or custom JavaScript.
- Treat CTR spikes only as a signal to inspect traffic quality and placement context.
- Prioritize account-side Policy Center verification before any placement experiment.

## Missing evidence required to close the audit

1. AdSense Policy Center status as of the review date.
2. URL, device, country, traffic-source, and ad-unit exports covering the four outlier dates.
3. Confirmation that no paid, incentivized, bot, or click-exchange traffic was used.
4. A mobile visual check of the 33 candidate pages after deployment.

Until those checks are available, the safe operating decision is **maintain or
increase separation; do not optimize CTR**.
