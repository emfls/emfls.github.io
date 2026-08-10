# Ten New Revenue-Oriented English Tools Design

## Objective

Publish ten original English browser tools with durable, repeat-use search intent. The pages expand the site's monetizable English utility coverage without requiring a server or sending calculation inputs to the site owner.

The repository has no physical `/en/` directory. Its established English sections are the unprefixed `/util/`, `/game/`, and `/report/` paths, while translated sections use prefixes such as `/kor/`, `/jp/`, and `/cn/`. These new English pages therefore follow the existing `/util/` path convention and must declare `<html lang="en">`; English wording and metadata should use the current English tool pages as references.

## Pages and behavior

1. `/util/discount-calculator/` calculates final price and savings from an original price and discount percentage. It accepts zero discount and rejects negative prices or percentages outside 0–100.
2. `/util/profit-margin-calculator/` calculates profit, margin percentage, and markup percentage from cost and selling price. It rejects negative values and reports a clear error when cost or revenue creates an undefined percentage.
3. `/util/unit-price-calculator/` compares two products by total price and quantity, reports each unit price, and identifies the lower unit cost. Prices and quantities must be positive finite values.
4. `/util/fuel-cost-calculator/` estimates fuel needed, trip fuel cost, and optional per-person cost from distance, fuel efficiency, fuel price, and traveler count. It states that traffic, route, vehicle load, and real-world efficiency are excluded.
5. `/util/tip-calculator/` calculates tip, total, and per-person amounts from bill, tip percentage, and party size. It accepts a zero tip and explains that local customs and service charges vary.
6. `/util/split-bill-calculator/` divides a bill among 1–100 people with optional tax and tip percentages. It displays total extras, grand total, and per-person amount while noting that equal splitting may not match individual orders.
7. `/util/sales-tax-calculator/` supports adding tax to a pre-tax amount and extracting included tax from a tax-inclusive total. It does not infer jurisdictional rates and states that exemptions and local rules are excluded.
8. `/util/gpa-calculator/` calculates weighted GPA from multiple course rows containing credits and grade points. It supports adding and removing rows, requires positive credits and grade points from 0 through 4, and explains that institutional grading scales differ.
9. `/util/running-pace-calculator/` converts distance and elapsed time into pace per kilometer, pace per mile, and average speed. It validates positive distance and time and states that GPS and course conditions affect measured pace.
10. `/util/data-storage-converter/` converts among B, KB, MB, GB, TB and KiB, MiB, GiB, TiB while clearly distinguishing decimal multiples of 1,000 from binary multiples of 1,024.

## Shared page contract

- Each page is a standalone `index.html` with `<html lang="en">`, using the existing `/util/new-tools.css` stylesheet, semantic `main`, one visible `h1`, accessible labels, visible keyboard focus, and responsive controls.
- Each page includes the existing GA4 measurement ID `G-QP5Q67GE5B` and AdSense publisher ID `ca-pub-8830524482034754` without changing either identifier.
- Each page uses a trailing-slash canonical matching its directory URL.
- Each page includes valid `WebApplication` and `FAQPage` JSON-LD objects with `dateModified` set to `2026-08-10`.
- Each page visibly displays `Reviewed: 2026-08-10`, concise instructions, calculation limitations, and a privacy note that distinguishes local input processing from ordinary analytics and advertising data collection.
- Input errors appear in a live result region. Calculations never silently emit `Infinity`, `NaN`, or an empty result.
- User input is rendered with `textContent` or form values and is never inserted through `innerHTML`.
- Advertising elements and frames remain constrained by the shared stylesheet's `max-width: 100% !important` rule.
- Every page links back to `/util/` and to at least two closely related tools.

## Calculation precision

- Currency-style results display two decimal places while calculations retain JavaScript number precision until formatting.
- Percentages display up to two decimal places with unnecessary trailing zeros removed where practical.
- The unit-price and data-storage tools show enough significant digits to distinguish close results without claiming accounting-grade precision.
- GPA is calculated as total quality points divided by total credits and displayed to two decimal places.
- Running pace is rounded to the nearest second for display; average speed is displayed to two decimal places.

## Discovery

- Add all ten canonical URLs to `/util/sitemap.xml` with last modification date `2026-08-10`.
- Add a `Money, study, and everyday calculators` section to `/util/index.html` linking every new page.
- Cross-link related tools: discount with margin and sales tax; tip with split bill and sales tax; unit price with discount; fuel cost with split bill; GPA with percentage; running pace with time difference; data storage with data converter.

## Testing and release

- Write a contract test before creating production pages. It must fail because the ten directories do not yet exist.
- The contract test checks file existence, canonical mapping, title and H1 intent, function markers, GA4, AdSense, shared CSS, review date, local-processing disclosure, schemas, safe output handling, hub links, and sitemap entries.
- Add executable JavaScript calculation tests for representative normal and boundary cases, including zero discount, zero tip, tax extraction, undefined margin, invalid quantities, GPA weighting, pace conversion, and decimal-versus-binary storage conversion.
- Run the focused tests, full pytest suite, inline JavaScript syntax validation, JSON-LD parsing, local-link existence checks, and `git diff --check`.
- Commit and push to `main`, then confirm the GitHub Pages deployment result.

## Success criteria

- Ten working pages are reachable through the utility hub and utility sitemap.
- Normal calculations match independently stated expected values and invalid inputs produce readable errors.
- No page promises traffic, revenue, legal tax accuracy, institutional GPA acceptance, or medically meaningful athletic performance.
- Existing and new tests pass before publication.
- Search and AdSense performance are evaluated after crawl and traffic data accumulate; publication itself does not guarantee earnings.
