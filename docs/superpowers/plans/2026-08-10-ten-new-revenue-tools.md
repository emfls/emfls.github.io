# Ten New Revenue-Oriented English Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish ten tested English browser calculators under the existing unprefixed `/util/` English section.

**Architecture:** Each calculator is a static `index.html` with its own form, validation, calculation function, metadata, two JSON-LD blocks, trust copy, and related links. Existing shared CSS provides the visual system and ad containment; the English utility hub and sitemap provide discovery.

**Tech Stack:** Static HTML5, CSS, browser JavaScript, JSON-LD, Python unittest/pytest, Node.js validation

## Global Constraints

- Every page uses `<html lang="en">` and a trailing-slash `/util/<slug>/` canonical.
- Every page uses `/util/new-tools.css`, GA4 `G-QP5Q67GE5B`, and AdSense `ca-pub-8830524482034754`.
- Every page visibly displays `Reviewed: 2026-08-10` and distinguishes local calculation input processing from ordinary analytics and advertising data collection.
- Every page includes separate `WebApplication` and `FAQPage` JSON-LD objects with `dateModified` equal to `2026-08-10`.
- Calculations must reject non-finite or invalid ranges and never silently display `Infinity` or `NaN`.
- User input must never be written with `innerHTML`.
- Currency results use two decimals, GPA uses two decimals, and running pace rounds to the nearest second.

---

### Task 1: Publication contract and calculation behavior tests

**Files:**
- Create: `tests/test_ten_new_revenue_tools.py`

**Interfaces:**
- Consumes: the ten slugs and function markers defined in the design spec.
- Produces: `TenNewRevenueToolsTest`, which protects publication metadata, discovery, safe rendering, and real calculation outputs executed with Node.

- [ ] **Step 1: Write the failing publication test**

Create a table containing `discount-calculator/calculateDiscount`, `profit-margin-calculator/calculateMargin`, `unit-price-calculator/compareUnitPrices`, `fuel-cost-calculator/calculateFuelCost`, `tip-calculator/calculateTip`, `split-bill-calculator/calculateSplitBill`, `sales-tax-calculator/calculateSalesTax`, `gpa-calculator/calculateGpa`, `running-pace-calculator/calculatePace`, and `data-storage-converter/convertStorage`. For every row assert the HTML file exists, uses the exact canonical, includes the marker, IDs, stylesheet, review date, local-processing disclosure, safe output, and both schema types. Assert hub and sitemap links for every slug.

- [ ] **Step 2: Run the publication test to verify RED**

Run: `python3 -m pytest tests/test_ten_new_revenue_tools.py -q`

Expected: FAIL because `/util/discount-calculator/index.html` and the other nine pages do not exist.

- [ ] **Step 3: Add hand-derived calculation fixtures to the test**

Execute each page's pure calculation function in Node with literal cases: 100 at 20% gives 80 and 20; cost 60/sale 100 gives profit 40, margin 40%, markup 66.6667%; unit prices 3 and 2 identify product B; 500 km at 10 km/L and 2 currency/L gives 50 L and 100; bill 100 at 20% for 4 gives 5 tip/person and 30 total/person; bill 100 with 10% tax and 20% tip for 5 gives 130 total and 26/person; extracting 10% from 110 yields base 100 and tax 10; GPA for 3 credits at 4.0 and 1 credit at 2.0 gives 3.5; 5 km in 25 minutes gives 5:00/km and 12 km/h; 1 GiB gives 1,073,741,824 bytes and 1.073741824 GB.

### Task 2: Money and shopping calculators

**Files:**
- Create: `util/discount-calculator/index.html`
- Create: `util/profit-margin-calculator/index.html`
- Create: `util/unit-price-calculator/index.html`
- Create: `util/tip-calculator/index.html`
- Create: `util/split-bill-calculator/index.html`
- Create: `util/sales-tax-calculator/index.html`

**Interfaces:**
- Produces pure functions returning result objects or `{error: string}`: `calculateDiscount(price, percent)`, `calculateMargin(cost, sale)`, `compareUnitPrices(priceA, qtyA, priceB, qtyB)`, `calculateTip(bill, tipPercent, people)`, `calculateSplitBill(subtotal, taxPercent, tipPercent, people)`, and `calculateSalesTax(amount, rate, mode)` where mode is `add` or `extract`.

- [ ] **Step 1: Implement the six standalone pages** with numeric range validation, submit handlers, `textContent` output, two schemas, limitations, FAQs, privacy disclosure, ad slot, and related links exactly as required by the design.
- [ ] **Step 2: Run the focused test** with `python3 -m pytest tests/test_ten_new_revenue_tools.py -q`; expected remaining failures are only the four pages from Tasks 3 and 4 plus missing discovery links.

### Task 3: Travel, study, and fitness calculators

**Files:**
- Create: `util/fuel-cost-calculator/index.html`
- Create: `util/gpa-calculator/index.html`
- Create: `util/running-pace-calculator/index.html`

**Interfaces:**
- Produces `calculateFuelCost(distance, efficiency, fuelPrice, people)`, `calculateGpa(courses)` where courses is an array of `{credits, points}`, and `calculatePace(distanceKm, totalSeconds)`.

- [ ] **Step 1: Implement the fuel calculator** returning liters, total cost, and per-person cost, with positive distance/efficiency/price and integer party size validation.
- [ ] **Step 2: Implement the GPA calculator** with removable course rows, positive credit validation, 0–4 grade points, weighted total calculation, and institutional-scale warning.
- [ ] **Step 3: Implement the pace calculator** with distance, hours, minutes, and seconds inputs and output for pace/km, pace/mile, and km/h.
- [ ] **Step 4: Run the focused test**; expected remaining failure is only the data storage page and discovery links.

### Task 4: Data storage converter and discovery

**Files:**
- Create: `util/data-storage-converter/index.html`
- Modify: `util/index.html`
- Modify: `util/sitemap.xml`

**Interfaces:**
- Produces `convertStorage(value, fromUnit, toUnit)` using explicit factors for decimal B/KB/MB/GB/TB and binary KiB/MiB/GiB/TiB.
- Makes all ten new canonical URLs reachable from the English utility hub and utility sitemap.

- [ ] **Step 1: Implement the storage converter** with positive finite input validation and visible decimal-versus-binary explanation.
- [ ] **Step 2: Add a hub section** titled `Money, study, and everyday calculators` containing ten root-relative links.
- [ ] **Step 3: Add ten sitemap entries** with `<lastmod>2026-08-10</lastmod>`.
- [ ] **Step 4: Run the focused test** and confirm all new contract and calculation cases pass.

### Task 5: Record, verify, and publish

**Files:**
- Modify: `docs/growth/2026-08-01-priority-rollout-log.md`

- [ ] **Step 1: Record the publication** including page names, calculation limits, English path convention, discovery changes, and reevaluation date `2026-09-07`.
- [ ] **Step 2: Verify all behavior** with `python3 -m pytest -q`, inline JavaScript syntax parsing for all ten pages, JSON-LD parsing for all ten pages, local-link existence checks, and `git diff --check`.
- [ ] **Step 3: Commit the exact implementation files** with message `Publish ten revenue-oriented English tools`.
- [ ] **Step 4: Push `main` and inspect the GitHub Pages workflow** for the new commit.
