import { calculate } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('calculator');
const numericFields = ['basis', 'proceeds', 'gains', 'priorOrdinary', 'fed', 'state', 'gainsRate', 'capital', 'active'];
const choiceFields = ['filing', 'disposition', 'domestic', 'original', 'holder', 'exception', 'transitional'];
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const whole = new Intl.NumberFormat('en-US');
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const money = value => value === null ? '—' : usd.format(value);
const count = value => value === null ? '—' : whole.format(value);

function setText(id, value) {
  byId(id).textContent = value;
}

function showSide(prefix, scenario) {
  setText(prefix + '-savings', money(scenario?.savings ?? null));
  setText(prefix + '-gains', money(scenario?.gainOffset ?? null));
  setText(prefix + '-income', money(scenario?.incomeOffset ?? null));
  setText(prefix + '-carryover', money(scenario?.carryover ?? null));
  setText(prefix + '-years', count(scenario?.taxYears ?? null));
}

function showSplit(result, disposition) {
  const split = result.split;
  byId('split-plan').hidden = split === null;
  if (split === null) {
    let message = 'The modeled loss fits within the available 2026 ordinary-loss limit.';
    if (disposition === 'worthless') {
      message = 'The split is unavailable for wholly worthless stock. Use the year the stock actually became worthless.';
    } else if (result.eligibility !== 'eligible') {
      message = 'The planner needs a passing eligibility screen before it can model two ordinary-loss limits.';
    } else if (result.loss === 0) {
      message = 'There is no realized loss to allocate across years.';
    }
    setText('split-note', message);
    return;
  }

  setText('split-note', split.firstLoss === 0
    ? 'The 2026 limit is used up. This scenario shifts the modeled sale into 2027.'
    : 'This allocation uses as much of the 2026 limit as possible and defers only the loss that could use the 2027 limit.');
  setText('split-first-loss', money(split.firstLoss));
  setText('split-first-ordinary', money(split.firstOrdinary));
  setText('split-second-loss', money(split.secondLoss));
  setText('split-second-ordinary', money(split.secondOrdinary));
  setText('split-total-loss', money(result.loss));
  setText('split-total-ordinary', money(split.totalOrdinary));
  setText('split-summary', 'Additional ordinary loss across both years is '
    + money(split.secondOrdinary) + '. Remaining capital loss is ' + money(split.capitalLoss) + '.');
}

function render() {
  const inputs = {};
  for (const name of numericFields) inputs[name] = form.elements.namedItem(name).valueAsNumber;
  for (const name of choiceFields) inputs[name] = form.elements.namedItem(name).value;
  const result = calculate(inputs);
  const error = byId('error');
  error.hidden = !result.error;
  error.textContent = result.error ?? '';
  byId('results').hidden = Boolean(result.error);
  if (result.error) {
    byId('split-plan').hidden = true;
    setText('split-note', 'Complete the calculator inputs to see a split-sale estimate.');
    return;
  }

  const badge = byId('badge');
  badge.dataset.state = result.eligibility;
  const labels = {
    eligible: 'Form 4797 Part II · Passes eligibility screen',
    ineligible: 'Form 4797 Part II · Fails eligibility screen',
    review: 'Form 4797 Part II · Eligibility needs review',
  };
  badge.textContent = labels[result.eligibility];
  const eligibilityNote = byId('eligibility-note');
  let eligibilityMessage = '';
  if (result.eligibility === 'review') {
    eligibilityMessage = result.capitalReview
      ? 'Verify the issuer’s threshold year, any designation of qualifying shares and any pro-rata allocation before estimating an ordinary loss.'
      : 'Resolve the uncertain eligibility answers before estimating an ordinary loss.';
  } else if (result.eligibility === 'eligible' && result.ordinary === 0) {
    eligibilityMessage = result.loss === 0
      ? 'These amounts produce no deductible stock loss.'
      : 'Other §1244 losses have used the full ordinary-loss limit for 2026.';
  }
  eligibilityNote.hidden = eligibilityMessage === '';
  eligibilityNote.textContent = eligibilityMessage;

  setText('advantage', money(result.advantage));
  setText('loss', money(result.loss));
  setText('remaining-cap', money(result.remainingOrdinaryCap));
  setText('ordinary', money(result.ordinary));
  setText('capital-loss', money(result.capitalLoss));
  setText('years-saved', count(result.yearsSaved));
  showSide('with', result.with1244);
  showSide('standard', result.standard);
  setText('capacity', 'After 2026 capital gains, the standard loss uses '
    + decimal.format(result.standard.equivalentYears) + ' years of ' + money(result.capitalIncomeCap)
    + ' deduction capacity. The table counts every tax year used, including 2026 and any partial final year.');
  setText('live-summary', result.advantage === null ? labels.review
    : 'Ordinary loss ' + money(result.ordinary) + '. Extra first-year tax savings ' + money(result.advantage) + '.');
  showSplit(result, inputs.disposition);
}

form.addEventListener('input', render);
form.addEventListener('submit', event => {
  event.preventDefault();
  render();
});
render();
