# Six Keyword Opportunity Pages Design

Date: 2026-09-10  
Status: Approved in chat; pending written-spec review

## Goal

Publish six useful Korean pages from the selected Keyword Hunter opportunities while protecting site quality, avoiding thin keyword variants, and limiting high-stakes claims to current official evidence.

## Scope

Create these public pages:

1. `/kor/util/car-inspection-cost/`
2. `/kor/util/date-calculator/`
3. `/kor/util/retirement-pension-withdrawal/`
4. `/kor/report/camp/carbon-monoxide-detector.html`
5. `/kor/report/visa/esta-application-checklist.html`
6. `/kor/report/animal/pet-food-selector.html`

Update the relevant Korean utility, camping, visa, and animal hubs; their sitemaps; the Korean sitemap when required by the existing publication pattern; content metadata; launch manifest; publication experiments; Keyword Hunter publication state; and project history. Preserve canonical URLs, GA4, AdSense publisher identity, policy links, and existing protected pages.

## Shared Page Contract

Every page must:

- be a complete answer to one search intent rather than a keyword-swapped template;
- have one canonical URL, a unique title and H1, a mobile viewport, descriptive meta text, and visible last-reviewed date;
- include WebPage or WebApplication structured data and FAQPage only when the visible FAQ matches it;
- work on mobile and with keyboard navigation;
- avoid `innerHTML` for user-controlled values;
- retain the site's existing GA4 and AdSense identifiers without changing monetization code;
- link to related site pages only where the destination answers a genuine next question;
- name official sources and the date on which time-sensitive information was checked;
- display `확인 필요` instead of guessing when a value cannot be safely established;
- avoid claims that ad clicks, income, rankings, approval, medical outcomes, legal eligibility, or tax outcomes are guaranteed.

## Page 1: 자동차검사 비용·예약 도우미

### User job

Help a Korean vehicle owner understand which inspection may apply, see a current fee reference, identify possible reductions, and reach the official reservation service.

### Experience

The first screen asks for inspection type and vehicle size/category using labels that match the authoritative fee source. The result presents a clearly labeled reference fee and checked date. A decision guide explains the difference between regular and comprehensive inspections without claiming to determine legal eligibility from incomplete inputs.

Supporting sections cover reservation steps, fee reduction checks, agency-service fee separation, inspection-period cautions, and common questions. Official booking remains on the official service; this site does not collect vehicle or personal information.

### Safety rules

- Do not invent or extrapolate fees.
- Separate statutory/official inspection fees from private agency charges.
- If regional, vehicle, or station conditions affect the fee, show the limitation beside the result.
- Do not describe the result as a binding quote.

## Page 2: 날짜 계산기

### User job

Calculate calendar differences and offsets without sending dates to a server.

### Experience

One page contains four modes: date difference, add/subtract days, D-day, and weekday calculation. Users can choose whether the starting date is counted. Weekday mode excludes Saturday and Sunday and states that public holidays are not excluded unless a verified holiday dataset is explicitly added later.

All calculations run locally. Results must cover leap years, reverse date order, invalid dates, zero-day offsets, and inclusive/exclusive counting. The page explains each convention beside the result.

## Page 3: 퇴직연금 수령 시나리오 비교기

### User job

Compare simple gross-payment scenarios before consulting the pension provider or a qualified tax professional.

### Experience

Inputs are balance, desired payment period, and optional assumed annual return. Outputs are clearly labeled illustrations: equal monthly gross withdrawal without return and, when the user supplies a return assumption, an amortized monthly illustration. The page explains the difference between DB, DC, and IRP at a high level and links users to official pension/tax references.

### Safety rules

- Do not calculate personalized tax, eligibility, or the financially optimal method.
- Do not prefill an expected investment return or present one as normal.
- Clearly state that fees, taxes, market movement, provider rules, and legal requirements are excluded.
- Position the tool as preparation for a provider or professional consultation, not advice.

## Page 4: 캠핑 일산화탄소 경보기 안전 가이드

### User job

Prevent carbon-monoxide exposure by understanding prevention, alarm placement principles, pre-trip checks, and emergency actions.

### Experience

The page opens with an emergency action panel, followed by prevention rules, a printable-style pre-trip checklist, placement principles based on the selected authoritative guidance, alarm testing and replacement checks, and product-selection criteria. It connects to relevant camping pages as a safety prerequisite rather than as a product roundup.

### Safety rules

- Never imply an alarm makes fuel-burning equipment safe inside a tent or vehicle.
- Emergency guidance takes visual priority over monetization and product content.
- Product criteria focus on recognized certification, audible alarm, test function, battery status, and manufacturer instructions; no unsupported product ranking.
- Affiliate disclosure is required beside any future commercial link.

## Page 5: ESTA 신청 체크 도우미

### User job

Understand what to prepare, avoid unofficial sites, and reach the official ESTA service.

### Experience

An interactive checklist covers basic travel-document preparation and questions users should verify themselves. The page prominently links the official application service and explains that ESTA is travel authorization, not a visa or admission guarantee. It includes fee and timing only when verified from current U.S. government sources and shows the checked date.

### Safety rules

- Do not determine eligibility or predict approval.
- Do not collect passport, payment, address, criminal-history, or other sensitive information.
- Do not reproduce an application form.
- Official links and scam avoidance appear before ads or related links.

## Page 6: 반려동물 사료 선택 도우미

### User job

Prepare a neutral shortlist of label questions based on species, life stage, body condition, and disclosed sensitivities.

### Experience

The user selects dog or cat, life stage, general body-condition goal, and whether a known sensitivity exists. The output is a label-reading checklist and questions for a veterinarian; it does not name a product or diagnose a condition. Supporting sections explain complete-and-balanced labeling, gradual transition, portion-label interpretation, and warning signs that require professional care.

### Safety rules

- No disease-specific diet recommendation, diagnosis, dosage, or therapeutic claim.
- Puppies, kittens, pregnancy, persistent symptoms, weight loss, or diagnosed disease route to veterinary advice.
- Do not rank brands without independently verified product data and a separate approved scope.
- Affiliate content, if added later, must be clearly separated from the neutral selector.

## Information Architecture

- The three utilities appear in the Korean utility hub and utility sitemap.
- The three guides appear in their existing topic hubs and topic sitemaps.
- Related links are reciprocal only where useful: camping winners may link to the CO safety guide; visa hub may link to ESTA; relevant animal guidance may link to the label selector.
- No new category hub is introduced.
- No page is duplicated for keyword variants such as `자동차정기검사비용` or `미국ESTA비자신청`; those variants map to sections within the canonical page.

## Source Strategy

Before implementation, verify current facts using primary sources only:

- Korean vehicle inspection: Korea Transportation Safety Authority or the official government/service source that publishes fees, reductions, inspection definitions, and booking.
- Retirement pension: Korean government, Financial Supervisory Service, National Tax Service, or governing statutes for definitions and limitations.
- Carbon monoxide: Korean fire/public-safety authorities where adequate; otherwise recognized national public-health/fire authorities for general safety principles, clearly identified by jurisdiction.
- ESTA: U.S. Customs and Border Protection and other official U.S. government pages.
- Pet food labels: Korean regulator guidance where adequate and recognized veterinary/regulatory primary guidance for general label-reading principles.

Every time-sensitive claim records its source and checked date in content metadata. A missing or conflicting official value is omitted rather than filled from a commercial secondary source.

## Data and Privacy

All calculators and selectors run entirely in the browser. They do not persist, transmit, or log user-entered dates, balances, vehicle selections, passport information, or pet conditions. Existing aggregate GA4 page-view behavior remains unchanged.

## Publication Records

Each page receives one launch experiment with a unique ID, publication timestamp, 28-day observation window, target query, baseline availability, and hypothesis. Keyword Hunter records are updated from `NEW` to `PUBLISHED` only after the page exists and its canonical URL passes validation. The launch manifest contains exactly the six new URLs and the hubs and sitemaps changed for discovery.

## Testing

Tests are written before production pages and must initially fail because the pages or required behavior do not exist.

Automated checks cover:

- canonical, title, H1, viewport, reviewed date, GA4, AdSense, source links, structured data, and privacy/safety copy for all six pages;
- date calculations for leap years, reverse ordering, inclusive counting, offsets, and weekdays;
- vehicle fee lookup only for source-backed combinations plus explicit unknown handling;
- retirement illustration math, zero return, invalid inputs, and disclosure text;
- selectors and checklists using DOM-safe rendering without sensitive-data collection;
- hub and sitemap discovery;
- launch manifest, metadata, experiments, and Keyword Hunter published status;
- focused content-launch guard and SEO QA.

Final verification includes the focused tests, content launch guard, SEO QA, link checks for changed pages, and desktop/mobile browser inspection of each distinct layout family.

## Non-goals

- No server, account, database, API integration, booking proxy, form submission, or storage of user inputs.
- No automatic product feed, price comparison, affiliate catalog, personalized tax engine, legal eligibility engine, medical diagnosis, or visa approval prediction.
- No edits to protected winner or active experiment page bodies unless a small related-link addition is explicitly allowed by the existing protection rules.
- No redesign of common site navigation, analytics, ad placement, or unrelated pages.

## Success Criteria

- All six canonical URLs are publicly discoverable from the correct hubs and sitemaps.
- Interactive results are correct for the tested contracts and understandable without hidden assumptions.
- Official-source and safety constraints are visible at the point where they affect decisions.
- Publication records are internally consistent and the six pages enter a 28-day observation period.
- Existing protected pages and unrelated user changes remain untouched.

