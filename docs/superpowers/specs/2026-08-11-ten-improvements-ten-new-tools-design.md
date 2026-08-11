# Ten Improvements and Ten New English Tools Design

## Objective

Improve ten existing GA4 landing pages and publish ten original English browser calculators. The work must preserve existing interactive behavior, correct outdated or overconfident guidance, expand durable English utility intent, and make all twenty pages discoverable and testable without promising traffic or AdSense revenue.

## Existing pages to improve

1. `kor/report/travel/turkey-kahramanmaras.html`
2. `kor/report/travel/vietnam-haiduong.html`
3. `kor/report/travel/vietnam-haiphong.html`
4. `kor/report/travel/데이트-코스.html`
5. `kor/report/visa/kazakhstan.html`
6. `kor/report/visa/laos.html`
7. `kor/report/visa/norway.html`
8. `kor/report/visa/thailand.html`
9. `kor/report/visa/turkey.html`
10. `ru/game/SnakeGame/index.html`

### Improvement contract

- Use review date `2026-08-11` and purpose-appropriate `WebPage` or `VideoGame` JSON-LD.
- Retain the existing canonical path but normalize directory canonicals to a trailing slash.
- Add `max-width:100%` advertising containment without changing GA4 `G-QP5Q67GE5B` or AdSense `ca-pub-8830524482034754`.
- Travel and visa pages must state that entry, safety, transport, and local rules can change and direct readers to relevant official authorities before booking or departure.
- Norway must explain cumulative Schengen stay accounting. Türkiye naming should use `튀르키예` in current visible guidance while retaining discoverability for the common Korean term `터키` where useful.
- The date-course article must state that price, opening hours, reservation availability, weather, and personal preference vary; it must not imply guaranteed romance or current availability.
- The Russian Snake game must disclose device-dependent controls and entertainment-only scoring and link to related Russian games.
- Every page must add useful related navigation while preserving existing scripts.

## New English pages and behavior

The repository's established English area is the unprefixed `/util/` path. Every new page uses `<html lang="en">`.

1. `/util/hourly-salary-calculator/` converts hourly pay to weekly, monthly, and annual gross pay from hours per week and working weeks per year.
2. `/util/overtime-pay-calculator/` calculates regular pay, overtime pay, and total weekly pay from hourly rate, regular hours, overtime hours, and overtime multiplier.
3. `/util/commission-calculator/` calculates commission and total earnings from sales, commission rate, and optional base pay.
4. `/util/break-even-calculator/` calculates break-even units and revenue from fixed cost, price per unit, and variable cost per unit; contribution margin must be positive.
5. `/util/roi-calculator/` calculates gain, net return, and ROI percentage from initial cost and final value; it explicitly excludes time, tax, risk, and cash-flow timing.
6. `/util/electricity-cost-calculator/` estimates energy use and cost from watts, hours per day, days, and price per kWh.
7. `/util/download-time-calculator/` estimates ideal transfer time from file size and connection speed while distinguishing bytes from bits and warning about protocol overhead and real-world speed.
8. `/util/grade-calculator/` calculates current weighted grade from multiple score, maximum-score, and weight rows; weights must be positive and scores cannot exceed maximums.
9. `/util/weighted-average-calculator/` calculates a weighted mean from multiple value and positive-weight rows.
10. `/util/recipe-scaler/` multiplies an ingredient quantity by original and target serving counts; it does not convert units or guarantee cooking outcomes.

## Shared new-page contract

- Each page is a standalone `index.html` using `../new-tools.css`, semantic `main`, one visible `h1`, accessible labels, a live result region, and no new runtime dependency.
- Each page includes the existing GA4 and AdSense identifiers, a trailing-slash canonical, and separate valid `WebApplication` and `FAQPage` JSON-LD with `dateModified` set to `2026-08-11`.
- Each page visibly displays `Reviewed: 2026-08-11`, explains its calculation and limitations, and distinguishes local input processing from ordinary analytics and advertising data collection.
- Pure calculation functions return result objects or `{error: string}` for invalid input. No calculation silently renders `Infinity` or `NaN`.
- User-provided values are rendered with form values or `textContent`, never `innerHTML`.
- Each page links to `/util/` and at least two related tools.

## Calculation definitions

- Hourly salary: weekly = hourly rate × hours/week; annual = weekly × working weeks/year; monthly = annual ÷ 12.
- Overtime: regular pay = hourly rate × regular hours; overtime pay = hourly rate × multiplier × overtime hours.
- Commission: commission = sales × rate/100; total earnings = base pay + commission.
- Break-even: contribution per unit = price − variable cost; break-even units = ceiling(fixed cost ÷ contribution); break-even revenue = units × price.
- ROI: gain = final value − initial cost; ROI = gain ÷ initial cost × 100.
- Electricity: kWh = watts ÷ 1000 × hours/day × days; cost = kWh × price/kWh.
- Download time: bytes are converted to bits and divided by bits per second using decimal network Mbps and explicit decimal/binary file-size options.
- Grade: sum of each percentage × weight divided by total weight.
- Weighted average: sum(value × weight) ÷ sum(weight).
- Recipe scale factor: target servings ÷ original servings; scaled quantity = quantity × factor.

## Discovery and records

- Add the ten new URLs to `util/sitemap.xml` with `2026-08-11` last-modified dates.
- Add an `Income, business, and everyday calculators` section to `util/index.html` containing all ten links.
- Cross-link closely related calculators, including salary/overtime/commission, break-even/ROI/margin, electricity/download/storage, grade/GPA/weighted average, and recipe scaler/unit converter.
- Record both batches in `docs/growth/2026-08-01-priority-rollout-log.md` with reevaluation date `2026-09-08`.

## Testing and release

- Write failing contract tests before modifying existing pages or creating new pages.
- Existing-page tests cover review date, schema, limitation copy, related navigation, and mobile ad containment.
- New-page tests cover existence, English language declaration, canonical, title/H1 intent, function marker, analytics and advertising IDs, shared CSS, visible review date, privacy disclosure, schemas, safe output handling, hub and sitemap discovery.
- Execute pure calculation functions with hand-derived fixtures and explicit invalid cases.
- Run the focused tests, full pytest suite, inline JavaScript syntax checks, JSON-LD parsing, local-link existence checks, HTML parsing, and `git diff --check`.
- Commit the implementation to `main`, push, and inspect the GitHub Pages deployment workflow.

## Success criteria

- Ten existing pages meet the improvement contract without breaking their existing scripts.
- Ten new calculators return the defined results for normal inputs and readable errors for invalid inputs.
- All new pages are linked from the English utility hub and utility sitemap.
- Existing and new automated tests pass before deployment.
- Publication is measured after crawl and usage data accumulate; it does not guarantee search traffic or revenue.
