# AdSense Safety Controls Design

## Objective

Reduce preventable AdSense policy and invalid-traffic risk without removing ads from substantive editorial travel content.

## Scope

- Remove AdSense loader, ad units, and ad push calls from every HTML page whose path contains a `game` directory.
- Remove the same code from `kor/privacy-policy.html`, `kor/terms.html`, and `kor/contact.html`.
- Preserve GA4, game logic, page content, navigation, and styles.
- Make the rewrite idempotent and auditable.
- Configure AdSense with a Google CMP that visibly offers consent, refusal, and option management.
- Add matching Auto Ads page exclusions where the AdSense interface supports section URLs.
- Audit a deterministic, stratified sample of 200 travel pages and classify each as maintain, improve, or exclude.

## Safety rules

- Never add click encouragement, deceptive labels, floating ads near controls, or ads on no-content pages.
- Do not change domains, canonical URLs, analytics IDs, or sitemap routing.
- A page is modified only when it is in an approved sensitive-page set.
- Every bulk rewrite must support a dry run and must be followed by repository tests and static inventory checks.

## Acceptance criteria

1. Zero approved sensitive pages contain `pagead2.googlesyndication.com`, `adsbygoogle`, or `<ins class="adsbygoogle">`.
2. A representative game page retains its game JavaScript and GA4 tag.
3. Running the rewriter twice changes zero files on the second run.
4. The 200-page travel audit contains exactly 200 unique pages with reasons and measurements.
5. The work log records account-side outcomes, code-side counts, tests, and deployment commit.
