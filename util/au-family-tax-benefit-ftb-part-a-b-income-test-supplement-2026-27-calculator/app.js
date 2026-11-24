import { calculateFTB } from './model.mjs';

const byId = id => document.getElementById(id);
const form = byId('ftb-form');
const results = byId('ftb-results');
const thresholds = byId('thresholds');
const cliffDetail = byId('cliff-detail');
const error = byId('ftb-error');
const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const percentage = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 3 });
const dollars = value => currency.format(value);
const write = (id, value) => { byId(id).textContent = value; };

function distanceText(distance) {
  if (distance === 0) return 'at the threshold';
  return `${dollars(Math.abs(distance))} ${distance > 0 ? 'below' : 'above'}`;
}

function renderImpact(label, impact) {
  write(`${label}-loss`, dollars(impact.loss));
  write(`${label}-rate`, `${percentage.format(impact.rate)}%`);
}

function update() {
  const household = byId('household').value;
  const couple = household === 'couple';
  const primaryField = byId('primary-ati');
  const secondaryField = byId('secondary-ati');
  const youngestField = byId('youngest');
  const childrenUnder13 = byId('children-under13').valueAsNumber;
  const children13To19 = byId('children-13to19').valueAsNumber;
  byId('secondary-field').hidden = !couple;
  secondaryField.disabled = !couple;
  youngestField.disabled = childrenUnder13 === 0 && children13To19 === 0;
  write('primary-label', couple ? 'Primary earner ATI (A$)' : 'Single parent ATI (A$)');

  let estimate;
  try {
    estimate = calculateFTB({
      household,
      primaryAti: primaryField.valueAsNumber,
      secondaryAti: secondaryField.valueAsNumber,
      childrenUnder13,
      children13To19,
      youngest: youngestField.value,
      supplements: byId('supplements').value === 'yes',
    });
  } catch (problem) {
    if (!(problem instanceof RangeError)) throw problem;
    error.textContent = problem.message;
    results.hidden = thresholds.hidden = cliffDetail.hidden = true;
    return;
  }

  error.textContent = '';
  results.hidden = thresholds.hidden = cliffDetail.hidden = false;
  const { partA, partB, distances, impact } = estimate;
  write('total-annual', dollars(estimate.totalAnnual));
  const income = `Family ATI ${dollars(estimate.familyAti)}`;
  write('assessed-income', couple
    ? `${income} · Higher earner ${dollars(estimate.primaryAti)} · Lower earner ${dollars(estimate.secondaryAti)}`
    : income);
  for (const [prefix, part] of [['a', partA], ['b', partB]]) {
    for (const metric of ['fortnight', 'annual', 'supplement']) {
      write(`${prefix}-${metric}`, dollars(part[metric]));
    }
  }

  write('primary-impact', couple ? 'Primary earner' : 'Single parent');
  renderImpact('primary', impact.primary);
  byId('secondary-impact').hidden = !couple;
  if (couple) renderImpact('secondary', impact.secondary);

  write('lower-distance', distanceText(distances.lowerA));
  write('higher-distance', distanceText(distances.higherA));
  write('supplement-distance', distanceText(distances.supplementA));
  write('cliff-distance', distanceText(distances.cliffB));
  cliffDetail.textContent = partB.cliffLoss > 0
    ? `With other inputs held constant, crossing this limit would cost ${dollars(partB.cliffLoss)} in Part B over the year.`
    : 'The current inputs give a $0.00 Part B estimate.';
}

form.addEventListener('input', update);
form.addEventListener('submit', event => {
  event.preventDefault();
  update();
});
update();
