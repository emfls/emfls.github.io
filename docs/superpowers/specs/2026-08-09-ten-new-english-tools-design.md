# Ten New English Tools Design

## Objective

Publish ten original, functional English-language browser tools that expand search coverage beyond the site's existing utilities. The pages target durable utility intent and higher-value English traffic without depending on a server or collecting the user's tool input.

## Pages and behavior

1. `/util/base64/` encodes UTF-8 text to Base64 and decodes valid Base64 to UTF-8. It rejects malformed input with a visible error.
2. `/util/url-encoder/` encodes and decodes URL components. It rejects malformed percent encoding and explains that it does not validate whether a URL is safe.
3. `/util/uuid-generator/` generates RFC 4122 version 4 UUIDs with `crypto.randomUUID()` when available and a `crypto.getRandomValues()` fallback. It can generate 1–100 UUIDs and copy the result.
4. `/util/unix-timestamp/` converts Unix seconds or milliseconds to local and UTC dates and converts a user-entered date/time to both units. It reports invalid or out-of-range values.
5. `/util/regex-tester/` compiles a JavaScript regular expression, reports invalid patterns or flags, and highlights matches safely with text nodes rather than injecting input as HTML.
6. `/util/aspect-ratio/` reduces width and height to a ratio and calculates a missing dimension from a target width or height. Values must be positive finite numbers.
7. `/util/percentage-calculator/` supports “X percent of Y,” “X is what percent of Y,” and percentage change. Division by zero produces a clear error rather than Infinity.
8. `/util/date-difference/` calculates signed calendar-day and elapsed-day differences between two dates. The copy explains the local-time basis and inclusive/exclusive distinction.
9. `/util/reading-time/` counts words and estimates reading time at a user-selected 100–1,000 words per minute. Text remains in the browser.
10. `/util/loan-payment-calculator/` estimates monthly payment, total payment, and total interest for a fixed-rate amortizing loan. It supports zero interest, validates positive term/principal, and states that fees, taxes, insurance, variable rates, and lender rounding are excluded.

## Shared page contract

- Each page is a standalone `index.html` using semantic `main`, one visible `h1`, responsive controls, and no new runtime dependency.
- Each title and description states the specific task without unsupported “best,” “secure,” or accuracy claims.
- Every directory URL uses a trailing-slash canonical.
- Every page includes the existing GA4 measurement ID `G-QP5Q67GE5B` and AdSense publisher ID `ca-pub-8830524482034754`.
- Responsive ad elements are constrained with `ins.adsbygoogle, div[id^="aswift_"] { max-width: 100% !important; overflow: hidden; }`.
- Each page contains separate valid `WebApplication` and `FAQPage` JSON-LD objects with `dateModified` set to `2026-08-09`.
- Each page visibly says `Reviewed: 2026-08-09`, links to `/util/`, and includes concise instructions, limitations, privacy wording, and FAQ content.
- Privacy wording distinguishes local tool-input processing from the ordinary device/usage data that analytics and advertising services may receive.
- User-provided content is never inserted through unsafe `innerHTML` operations.

## Discovery

Add all ten URLs to `sitemap.xml` with `2026-08-09` as the modification date. Add a “New browser tools” section to `/util/index.html` so users and crawlers can discover the pages without relying only on the sitemap. Link closely related new tools to one another where useful.

## Visual design

Use a compact shared visual language implemented independently in each static file: dark navy background, white content card, blue primary action, clear labels, visible focus states, and a single-column mobile layout. Results use an accessible live region. Advertising must not interrupt the input-to-result flow.

## Testing and release

Write a contract test before creating production pages. It must initially fail because the ten files are absent. The test checks URL/canonical mapping, title and H1 intent, GA4, AdSense, mobile ad constraints, visible review date, local-processing disclosure, two schema types, safe output patterns, hub links, sitemap entries, and tool-specific function markers.

After implementation, run the focused test, the full unit-test suite, JSON-LD parsing, HTML structure checks, and Node syntax checking for every inline non-JSON script. Commit to `main`, push, wait for GitHub Pages deployment, and verify representative live URLs.

## Success criteria

- Ten new functional pages are publicly reachable and linked from the utility hub and sitemap.
- All stated edge cases return readable results or errors without uncaught exceptions.
- Existing repository tests and the new contract tests pass.
- The deployed HTML contains the reviewed date and expected function marker on representative pages.
- Search performance is evaluated after enough crawl time; publication does not promise traffic or AdSense revenue.
