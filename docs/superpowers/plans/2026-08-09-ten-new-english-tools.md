# Ten New English Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish ten working English browser utilities with truthful guidance, search discovery, and automated coverage.

**Architecture:** Each route is a dependency-free static `index.html` using a shared stylesheet at `/util/new-tools.css` and a small page-local script. A repository test validates the shared publishing contract and each tool's public function marker.

**Tech Stack:** HTML5, CSS, browser JavaScript, Python `unittest`, GitHub Pages.

## Global Constraints

- Create exactly the ten routes approved in the design spec.
- Process tool input locally and never render user content through unsafe `innerHTML`.
- Include GA4 `G-QP5Q67GE5B`, AdSense `ca-pub-8830524482034754`, trailing-slash canonical, WebApplication and FAQPage JSON-LD, and visible `Reviewed: 2026-08-09` on every page.
- Add every URL to `/util/index.html` and `sitemap.xml`.
- Preserve existing files and avoid new runtime dependencies.

---

### Task 1: Publishing contract

**Files:**
- Create: `tests/test_ten_new_english_tools.py`

**Interfaces:**
- Consumes: approved route list and shared page contract.
- Produces: `TenNewEnglishToolsTest` covering files, metadata, schemas, disclosure, discovery, and tool markers.

- [ ] Write the test with the exact ten route/marker pairs and assertions from the design.
- [ ] Run `python3 -m unittest tests.test_ten_new_english_tools` and confirm failure because the pages do not exist.

### Task 2: Shared presentation and encoding tools

**Files:**
- Create: `util/new-tools.css`
- Create: `util/base64/index.html`
- Create: `util/url-encoder/index.html`
- Create: `util/uuid-generator/index.html`

**Interfaces:**
- Produces: responsive `.tool-shell`, `.panel`, form, result, error, FAQ, and disclosure styles; `runBase64`, `runUrlCodec`, and `generateUuids` page functions.

- [ ] Implement the shared CSS with visible focus, mobile layout, live result/error styles, and ad-frame width constraint.
- [ ] Implement UTF-8-safe Base64 encode/decode with malformed-input errors.
- [ ] Implement URL component encode/decode with malformed percent-encoding errors.
- [ ] Implement 1–100 UUID v4 generation using Web Crypto and copy support.

### Task 3: Developer and dimension tools

**Files:**
- Create: `util/unix-timestamp/index.html`
- Create: `util/regex-tester/index.html`
- Create: `util/aspect-ratio/index.html`

**Interfaces:**
- Produces: `convertTimestamp`, `testRegex`, and `calculateRatio` page functions.

- [ ] Implement seconds/milliseconds/date conversion with invalid-range handling.
- [ ] Implement JavaScript regex matching with duplicate-flag rejection and safe DOM text-node output.
- [ ] Implement GCD ratio reduction and missing-dimension calculation for positive finite inputs.

### Task 4: General calculators

**Files:**
- Create: `util/percentage-calculator/index.html`
- Create: `util/date-difference/index.html`
- Create: `util/reading-time/index.html`

**Interfaces:**
- Produces: `calculatePercentage`, `calculateDateDifference`, and `calculateReadingTime` page functions.

- [ ] Implement three percentage modes and explicit division-by-zero errors.
- [ ] Implement signed elapsed/calendar day calculations from local date inputs.
- [ ] Implement Unicode-aware word counting and reading-time estimates at 100–1,000 WPM.

### Task 5: Loan calculator

**Files:**
- Create: `util/loan-payment-calculator/index.html`

**Interfaces:**
- Produces: `calculateLoanPayment` for fixed-rate monthly amortization, including a zero-rate branch.

- [ ] Validate principal, annual rate, and year term, calculate monthly/total/interest values, and disclose excluded costs.

### Task 6: Discovery, verification, and release

**Files:**
- Modify: `util/index.html`
- Modify: `sitemap.xml`
- Modify: `docs/growth/2026-08-01-priority-rollout-log.md`

**Interfaces:**
- Consumes: all ten public routes.
- Produces: crawlable hub links, sitemap entries, and durable release record.

- [ ] Add a visible “New browser tools” section containing all ten links.
- [ ] Add all ten canonical URLs to the sitemap with `2026-08-09` modification dates.
- [ ] Record the ten-page publication, design limitations, tests, and reevaluation date in the growth log.
- [ ] Run the focused test and `python3 -m unittest discover -s tests`.
- [ ] Parse every JSON-LD block and run Node syntax checking on every new inline application script.
- [ ] Run `git diff --check`, commit, push `main`, wait for Pages, and confirm representative live pages.
