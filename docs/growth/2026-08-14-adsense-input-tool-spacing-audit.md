# AdSense input-tool spacing audit — 2026-08-14

## Outcome

- Increased the space between the interactive Word Counter and its following ad from 20px to 80px.
- Added a visible `Advertisement` label and an accessible advertisement label.
- Kept informational camp, travel, and Mabinogi guide pages unchanged because their ads follow static article content rather than an immediately adjacent control.

## Review scope

- Reviewed pages where an AdSense unit appeared near an input or button in source order.
- Confirmed there is no custom ad-click tracking or wording encouraging users to click ads.
- Selected `util/EasyLetterWordCounter/index.html` as the remaining genuine accidental-click risk because a large text input tool ended directly above the ad with only 20px spacing.

## Guardrail

`tests/test_word_counter_page.py` now prevents removal of the 80px separation and advertisement labels.
