# P5 Wave 5 — Google Search Console Collection Path Recovery

## Status

`COLLECTION_PATH_IMPLEMENTED` (workflow validation pending)

The previous blocker is resolved. `scripts/collect_gsc_snapshot.py` now uses the existing service-account secret at runtime, verifies the exact URL-prefix property, paginates Search Analytics page rows, and writes an atomic snapshot. `.github/workflows/gsc-collection.yml` runs daily at a separate schedule and supports `workflow_dispatch`.

## Evidence

- Property is explicitly `https://emfls.github.io/` (URL-prefix).
- Runtime alias `GOOGLE_SERVICE_ACCOUNT_JSON_B64` maps to the existing `GA4_SERVICE_ACCOUNT_JSON_B64` secret; no new key or service account is created.
- Empty/API/permission failures stop before snapshot replacement and before artifact commit.

Google's Search Console API requires a project credential and at least read access to the target property; the property identifier is the exact Search Console value, such as a URL-prefix URL or `sc-domain:` value. See [API prerequisites](https://developers.google.com/webmaster-tools/v1/prereqs) and [property permissions](https://developers.google.com/webmaster-tools/v1/sites).

## Validation status

Local fixture, pagination, normalization, duplicate aggregation, credential decoding, failure-safe, and pipeline integration tests pass. Actual GitHub Actions property read remains pending because the secret is not exposed to the local session.
