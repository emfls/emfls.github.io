# P5 Wave 5 — Google Search Console Collection Path Recovery

## Status

`BLOCKED_PROPERTY_PERMISSION_REQUIRED`

The repository has a historical/manual GSC import path only. `scripts/import_performance_csv.py` parses a user-supplied Search Console ZIP export; there is no Search Console API collector, OAuth/service-account contract, GSC workflow, or GSC secret in the repository. `.github/workflows/seo-qa.yml` consumes generated data and does not collect it.

## Evidence

- Current revenue measurement output has no connected GSC channel and keeps `NOT_CONNECTED`.
- The only repository GSC period is in the historical CSV-import artifact (`2026-08-03` to `2026-08-30`), not an automated current snapshot.
- No URL-prefix or Domain property identifier is stored in source, workflow, env contract, or reports. No property string was inferred from the production hostname.
- The GA4 service account may technically be used with Search Console API credentials, but repository evidence does not show that it has Search Console property access. It must not be assumed.

Google's Search Console API requires a project credential and at least read access to the target property; the property identifier is the exact Search Console value, such as a URL-prefix URL or `sc-domain:` value. See [API prerequisites](https://developers.google.com/webmaster-tools/v1/prereqs) and [property permissions](https://developers.google.com/webmaster-tools/v1/sites).

## Required external action

In Search Console, open the property that actually contains `emfls.github.io`, then add `emfls-ga4-reader@emfls-ga4.iam.gserviceaccount.com` with at least read permission. Record the exact property identifier and only then define a separate GSC credential/property secret contract. No API call or fabricated snapshot was made in this cycle.
