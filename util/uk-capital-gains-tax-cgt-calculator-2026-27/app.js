import { calculateCGT, compareScenarios, disposalGain, MAX_AMOUNT } from './model.mjs';

const field = (id) => document.getElementById(id);
const form = field('cgt-form');
const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const setText = (id, value) => { field(id).textContent = value; };

for (const input of form.querySelectorAll('input[type="number"]:not([max])')) {
  input.max = MAX_AMOUNT;
}

function readNumber(id, fallback = 0) {
  const input = field(id);
  if (input.validity.valid) {
    return input.value === '' ? fallback : input.valueAsNumber;
  }

  const label = input.labels[0].textContent;
  throw new RangeError(`Enter a valid value for “${label}” from ${input.min} to ${Number(input.max).toLocaleString('en-GB')}, with up to two decimal places.`);
}

function readCalculation(taxpayer, individual, estate) {
  const ordinaryGain = disposalGain({
    proceeds: readNumber('proceeds'),
    cost: readNumber('cost'),
    disposalCosts: readNumber('disposalCosts'),
    improvements: readNumber('improvements')
  });
  const exemptionLimit = field('exemptionLimit').value === '' && !field('exemptionLimit').validity.badInput
    ? undefined
    : readNumber('exemptionLimit');

  return {
    taxpayer,
    ordinaryGain,
    exemptionLimit,
    currentLosses: readNumber('currentLosses'),
    broughtForwardLosses: readNumber('broughtForwardLosses'),
    income: individual ? readNumber('income') : 0,
    pension: individual ? readNumber('pension') : 0,
    giftAid: individual ? readNumber('giftAid') : 0,
    badrGain: estate ? 0 : readNumber('badrGain'),
    badrUsed: estate ? 0 : readNumber('badrUsed'),
    investorsGain: individual ? readNumber('investorsGain') : 0,
    investorsUsed: individual ? readNumber('investorsUsed') : 0
  };
}

function showError(id, message = '') {
  setText(id, message);
  field(id).hidden = !message;
}

function showCalculation(result, gain) {
  for (const name of ['tax', 'taxableGain', 'currentLossesUsed', 'exemptionUsed', 'broughtForwardUsed', 'bandForMain']) {
    setText(name, gbp.format(result[name]));
  }
  setText('gain', gbp.format(gain));
  setText('unusedLosses', gbp.format(result.unusedCurrentLosses + result.unusedBroughtForwardLosses));
  setText('personalAllowance', result.personalAllowance === null ? '—' : gbp.format(result.personalAllowance));
  const rows = result.rows.map(({ label, rate, gain, tax }) => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = `${label} · ${rate}%`;
    row.append(heading);
    for (const amount of [gain, tax]) {
      row.insertCell().textContent = gbp.format(amount);
    }
    return row;
  });
  field('band-rows').replaceChildren(...rows);
  field('bands').hidden = rows.length === 0;
  field('relief-excess').hidden = result.reliefExcess === 0;
  setText('relief-excess', `${gbp.format(result.reliefExcess)} exceeds the relief lifetime limits and enters the ordinary gain calculation.`);
  field('calc-result').hidden = false;
}

function showComparison(input) {
  const share = readNumber('share');
  const extraPension = readNumber('extraPension');
  const partner = {
    income: readNumber('partnerIncome'),
    ordinaryGain: readNumber('partnerGain')
  };
  const scenarios = compareScenarios(input, { extraPension, share, partner });
  for (const name of ['pension', 'split', 'combined']) {
    const { savings, tax } = scenarios[name];
    const savingLabel = savings < 0 ? `${gbp.format(-savings)} more CGT` : `${gbp.format(savings)} saved`;
    setText(`${name}-saving`, savingLabel);
    const scope = name === 'pension' ? 'Your CGT' : 'Household CGT';
    setText(`${name}-tax`, `${scope} ${gbp.format(tax)}`);
  }
  setText('transfer-note', `Ordinary gain attributed to your partner in the split: ${gbp.format(scenarios.split.transferredGain)}.`);
  field('scenario-results').hidden = false;
}

function update() {
  const taxpayer = field('taxpayer').value;
  const individual = taxpayer === 'individual';
  const estate = taxpayer === 'estate' || taxpayer === 'estateNoAEA';
  for (const id of ['income-field', 'pension-field', 'gift-field', 'comparison']) {
    field(id).hidden = !individual;
  }
  field('relief-fields').hidden = estate;
  for (const node of form.querySelectorAll('[data-investors], [data-band]')) {
    node.hidden = !individual;
  }

  showError('calc-error');
  showError('compare-error');
  let input;
  try {
    input = readCalculation(taxpayer, individual, estate);
    showCalculation(calculateCGT(input), input.ordinaryGain);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    showError('calc-error', error.message);
    field('calc-result').hidden = true;
    field('scenario-results').hidden = true;
    return;
  }

  if (individual) {
    try {
      showComparison(input);
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      showError('compare-error', error.message);
      field('scenario-results').hidden = true;
    }
  }
}

form.addEventListener('input', update);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  update();
});
update();

for (const slot of document.querySelectorAll('.adsbygoogle[data-ad-slot]')) {
  if (slot.dataset.adSlot) (window.adsbygoogle ||= []).push({});
}
