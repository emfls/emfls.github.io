import { calculateConversion } from './model.mjs';

const byId = (id) => document.getElementById(id);
const form = byId('calculator');
const inputs = [...form.querySelectorAll('input')];
const coverage = [byId('partBCount'), byId('partDCount')];
const results = byId('results');
const error = byId('input-error');
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });

function showScenario(prefix, scenario) {
  for (const key of ['conversion', 'magi']) byId(prefix + '-' + key).textContent = dollars.format(scenario[key]);
  for (const key of ['taxableIncome', 'seniorDeduction', 'addedTax', 'addedIrmaa', 'totalCost']) {
    byId(prefix + '-' + key).textContent = money.format(scenario[key]);
  }
  byId(prefix + '-tier').textContent = String(scenario.tier);
  byId(prefix + '-allInRate').textContent = scenario.allInRate === null ? '—' : percent.format(scenario.allInRate);
}

function render() {
  const status = byId('status').value;
  const joint = status === 'joint';
  byId('spouse-field').hidden = !joint;
  byId('spouseAge').disabled = !joint;
  for (const select of coverage) {
    select.options[2].hidden = !joint;
    select.options[2].disabled = !joint;
    if (!joint && select.value === '2') select.value = '1';
  }

  let valid = true;
  for (const input of inputs) {
    const invalid = !input.disabled && !input.validity.valid;
    input.setAttribute('aria-invalid', String(invalid));
    valid = valid && !invalid;
  }
  error.hidden = valid;
  results.hidden = !valid;
  if (!valid) return;

  const result = calculateConversion({
    status,
    ...Object.fromEntries(inputs.map((input) => [input.id, input.valueAsNumber])),
    partBCount: Number(coverage[0].value),
    partDCount: Number(coverage[1].value),
    targetRate: Number(byId('targetRate').value),
  });
  const { baseline, cliffCeiling, irmaaHeadroom, nextCliffCost, proposed, optimized } = result;

  showScenario('proposed', proposed);
  showScenario('optimized', optimized);

  byId('cliff-summary').textContent = irmaaHeadroom === null
    ? `Starting Medicare MAGI is ${dollars.format(baseline.magi)} (tier 5). There is no higher tier under the 2026 benchmark.`
    : `Starting Medicare MAGI is ${dollars.format(baseline.magi)} (tier ${baseline.tier}). IRMAA headroom before the next tier is ${dollars.format(irmaaHeadroom)}, up to ${dollars.format(cliffCeiling)} in MAGI.`;
  const warning = byId('cliff-warning');
  warning.hidden = !nextCliffCost;
  if (nextCliffCost) {
    const crossing = `A conversion of ${dollars.format(irmaaHeadroom + 1)} reaches the next tier and adds ${money.format(nextCliffCost)} for one full premium year at your enrollment counts.`;
    warning.textContent = proposed.addedIrmaa > 0
      ? `Your proposal adds ${money.format(proposed.addedIrmaa)} in annual IRMAA. ${crossing}`
      : crossing;
  }

  byId('baseline').textContent = `Before conversion, federal taxable income is ${money.format(baseline.taxableIncome)} after a ${dollars.format(result.standardDeduction)} standard deduction and a ${money.format(baseline.seniorDeduction)} enhanced senior deduction.`;
  for (const { rate, taxableRoom, conversionRoom } of result.room) {
    byId('taxable-' + rate).textContent = money.format(taxableRoom);
    byId('conversion-' + rate).textContent = dollars.format(conversionRoom);
  }

  const ladder = byId('ladder-warning');
  ladder.hidden = !result.earlyWithdrawalWarning;
  ladder.textContent = `Roth conversion ladder: the five-tax-year conversion period ends January 1, ${result.unlockYear}. If you withdraw taxable converted principal earlier and are still under 59½, a 10% additional tax may apply unless you qualify for an exception. Earnings have separate rules.`;
}

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (event) => event.preventDefault());
render();
